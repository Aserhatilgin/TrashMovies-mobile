# Personal daily V1 pool release

`20261109000001_enable_personal_daily_pool_v1.sql` is a standalone data release,
not an automatically applied schema migration. It requires
`20261103000001_add_movie_taste_rpcs.sql` followed by
`20261106000001_add_personal_daily_movies.sql` and the existing catalogue.
Check the actual target's migration history before deciding which migrations
are missing. Keep `EXPO_PUBLIC_PERSONAL_DAILY_MOVIES_V1` off throughout preparation.

The SQL embeds exactly the 60 distinct UUIDs from the verified November 3, 2026
through January 1, 2027 manifest. It checks cardinality, locks all 60 existing
catalogue rows and checks missing IDs **before UPDATE**. Missing IDs or an
incomplete lock set abort the transaction with SQLSTATE `23503`. A postcondition
also rolls back the transaction unless all 60 requested films are enabled.

Only those films' eligibility is enabled. Existing eligible/ineligible films
outside the manifest are left untouched; report any unexpected already-enabled
films during the read-only preflight rather than silently disabling them.
No catalogue metadata, genres, genre links, assignments or shared `daily_movies`
rows are written. The existing movie `updated_at` trigger runs only for rows
whose eligibility actually changes. Running the file again performs no UPDATE.

Before an authorized release, compare all manifest UUIDs/TMDB identities with the
target catalogue and compare its common calendar with the verified manifest.
Run the complete SQL file as the database release operator, in a fresh connection
with stop-on-error behavior (`psql -X --set=ON_ERROR_STOP=1 --file=...`). Do not use
the authenticated mobile role, split the transaction or substitute the local
fixture setup script. Verify eligibility, unchanged nonmanifest rows and the
entire shared calendar before considering mobile activation. The SQL does not
change permissions or enable the mobile flag.

## Local regression check

From `mobile/`, with only the named isolated PostgreSQL container running:

```sh
node supabase/tests/daily_movies_release_local.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
```

The runner refuses remote Docker endpoints and non-test containers. It creates
disposable databases with the real catalogue DDL and read-only snapshots of the
local catalogue/calendar, without terminating existing sessions. It runs the
**same complete release SQL** twice with real COMMITs, checks all calendar rows
and columns, metadata/genre links, outside-manifest true/false sentinels, and
second-run `updated_at`/`xmin` stability. Another disposable DB omits one UUID;
the runner checks real SQLSTATE `23503` and no changes. Both temporary DBs are
removed in `finally`; the original test DB's catalogue/calendar is checked again.

## Verified locally on November 9, 2026

- First run: 60 newly enabled; second run: zero changes.
- Common calendar: all 60 rows and columns identical after both runs.
- Missing UUID: rejected before UPDATE; catalogue/calendar unchanged.
- Original isolated DB unchanged; both disposable databases removed.
- Remote MCP OAuth refresh failed. Remote migration history, permissions and
  calendar were not reverified; no remote release or flag activation occurred.
