# Movie taste database checks

These tests require a disposable **local** Supabase PostgreSQL 17 database. Never
target the application remote database or a company Docker project. No existing
containers, images, volumes, Docker settings or published membership are changed.

## Isolated setup on Docker Desktop / Node.js 24

Run from `mobile/`. The official npm CLI distribution is pinned to **3.0.0** in a
temporary tooling project; the application's dependencies are not modified.
The helper requires a new temporary `trashmovies-filmzevkim-db-*/project` directory,
refuses an existing migration chain and reserves an unused port block.

```sh
TM_TASTE_ROOT=$(mktemp -d /tmp/trashmovies-filmzevkim-db-XXXXXX)
mkdir -p "$TM_TASTE_ROOT/project" "$TM_TASTE_ROOT/tooling"
npm install --prefix "$TM_TASTE_ROOT/tooling" --save-dev --save-exact supabase@3.0.0 --no-audit --no-fund
TM_TASTE_DOCKER_HOST=$(docker context inspect desktop-linux --format '{{.Endpoints.docker.Host}}')

taste_cli() {
  case "$TM_TASTE_DOCKER_HOST" in
    unix://*) ;;
    *) echo 'A local Docker socket is required'; return 1 ;;
  esac
  env -u SUPABASE_ACCESS_TOKEN -u SUPABASE_DB_PASSWORD \
    SUPABASE_HOME="$TM_TASTE_ROOT/cli-state" SUPABASE_NO_KEYRING=1 \
    SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 \
    DOCKER_CONTEXT=desktop-linux DOCKER_HOST="$TM_TASTE_DOCKER_HOST" \
    "$TM_TASTE_ROOT/tooling/node_modules/.bin/supabase" "$@" \
    --workdir "$TM_TASTE_ROOT/project"
}

taste_cli init
node supabase/tests/prepare_movie_taste_local.ts "$TM_TASTE_ROOT/project"
# Continue only if preparation succeeded and printed the isolated project/ports.
taste_cli db start
taste_cli test db supabase/tests/movie_taste.sql
TM_TASTE_CONTAINER=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8')).container" "$TM_TASTE_ROOT/setup.json")
node supabase/tests/movie_taste_concurrency.ts "$TM_TASTE_CONTAINER"
```

`db start` starts the isolated database, rather than a full application stack.
Schema bootstrap may download versioned Supabase images and run short-lived jobs.
There are no stop, reset, prune or cleanup commands in this setup. Retain the
temporary directory and its `setup.json` to identify only this test's resources.
Do not use `--remote`, hosted connection URLs, login/link, or a normal app workdir.

Preparation copies every repository migration byte-for-byte and records SHA-256
hashes in `setup.json`. Two **temporary-only** migrations supply the extensions
assumed by the captured baseline and the catalog fixture. The fixture derives
all 15 UUID/TMDB identities and titles from the unchanged V1 migrations; remaining
metadata is explicitly synthetic. It runs before the real publication migration,
which creates the real immutable V1 membership/order. An empty `seed.sql` resolves
the missing local seed without changing the application's configuration.

## Coverage

`movie_taste.sql` creates two Auth fixtures in a rollback transaction and contains
32 pgTAP assertions: atomic rollback after a late trigger failure, owner isolation,
revision conflicts/retries/no-ops, optional clears, outside-set reaction preservation,
historic onboarding/identity/interaction preservation and write privileges.

`movie_taste_concurrency.ts` accepts only this test's container-name prefix and a
local Docker socket. It creates invocation-specific fixtures and opens two actual
authenticated `psql` sessions with the same expected revision. Before releasing A,
it verifies via `pg_stat_activity` / `pg_blocking_pids` that B is blocked by A:

- A COMMIT: B fails with SQLSTATE `40001`; A's complete four-domain snapshot wins.
- A ROLLBACK: B commits; B's complete snapshot wins.

Both cases verify exactly one revision increment and unchanged identity,
onboarding, demographics and outside-set reactions. Only their own fixture UUIDs
are deleted afterward, inside the dedicated test container.

## Executed validation

On 2026-11-03, CLI 3.0.0 and Supabase PostgreSQL 17.11 applied all 21 repository
migrations plus the two temporary bootstrap/fixture migrations. All **32 pgTAP
assertions passed**, and both real-session COMMIT/ROLLBACK cases passed with
observed PostgreSQL blocking. No hosted database operations were performed.
