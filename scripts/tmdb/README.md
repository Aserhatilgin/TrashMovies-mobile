# TMDB catalog importer

The importer fetches, filters, and normalizes TMDB movie candidates. Dry-run is
the safe inspection mode. Write mode explicitly synchronizes the accepted
catalog rows with Supabase.

## Configuration

Copy the example file and add your own TMDB API Read Access Token:

```bash
cp .env.import.example .env.import.local
```

`TMDB_READ_ACCESS_TOKEN` is required in both modes. Write mode additionally
requires:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_EXPECTED_PROJECT_REF
```

These are importer-only values. Never prefix them with `EXPO_PUBLIC_`, commit
them, or print them. The normal discovery importer reads Supabase variables only
when `--write` is chosen; the explicit-ID importer also needs them for its
read-only dry-run presence checks. Before creating the administrative client,
the shared configuration verifies that
`SUPABASE_URL` has the exact `<SUPABASE_EXPECTED_PROJECT_REF>.supabase.co`
hostname. A mismatch fails locally without displaying environment values.
It also rejects an obviously public `SUPABASE_SERVICE_ROLE_KEY`, including
publishable keys and decodable JWTs whose role is `anon`. This is a local
configuration sanity check, not cryptographic verification.

## Resolve Onboarding V1 movie IDs without importing

From `mobile/`, run the standalone resolver with a local TMDB token:

```bash
node --env-file=.env.import.local scripts/tmdb/resolve-onboarding-movies.ts
```

The resolver searches the 14 requested titles using their release years and
prints one JSON record per film with the requested title/year, match status,
TMDB ID, TMDB title, original title, and release date. Ambiguous or unmatched
results receive a null ID and a nonzero exit status so they require manual
review. It reads only `TMDB_READ_ACCESS_TOKEN`, does not create a Supabase
client, and cannot import movies or change `daily_movies`.

## Import the reviewed Onboarding V1 taste anchors

The explicit-ID importer fetches full TMDB details for the 14 reviewed movies,
checks their titles and release years, and uses the existing catalog writer for
movie, genre, and movie-genre upserts. It does not use the low-rating discovery
filter or change the normal 500-movie selection path. Run it from `mobile/`
with the importer-only credentials configured:

```bash
node --env-file=scripts/tmdb/importer.local.env scripts/tmdb/import-onboarding-movies.ts --dry-run
node --env-file=scripts/tmdb/importer.local.env scripts/tmdb/import-onboarding-movies.ts --write
```

The dry run reads catalog presence and all `daily_movies` rows but issues no
Supabase writes. It reports each proposed insert/update with its genres. Write
mode repeats the preflight, upserts only the reviewed catalog movies, verifies
all 15 onboarding movies including the already-cataloged *The Room*, and
compares `daily_movies` row count and full-row SHA-256 before and after. Repeating
write mode preserves movie UUIDs and does not duplicate genre relationships.
It does not write to `daily_movies` or any user or onboarding table.

## Five-movie dry run

From the `mobile/` directory, using Node.js 24:

```bash
node --env-file=.env.import.local scripts/tmdb/import-movies.ts --limit=5 --dry-run
```

`--limit` counts accepted movies rather than raw TMDB candidates. Exactly one
mode flag is required: `--dry-run` or `--write`. Dry-run performs zero Supabase
writes and does not create the administrative Supabase client.

## Five-movie write

After reviewing a dry run, explicitly enable writes with:

```bash
node --env-file=.env.import.local scripts/tmdb/import-movies.ts --limit=5 --write
```

Write mode uses the service-role key only in the standalone script writer; it
does not reuse the mobile application client. It upserts genres and movies by
their TMDB IDs, resolves internal UUIDs, upserts the composite movie/genre
relationships, and removes relationships no longer present in TMDB. Repeating
the same import does not create duplicate catalog or relationship rows.

The TMDB importer owns only TMDB catalog metadata. Its movie upsert explicitly
omits `imdb_id` and `imdb_rating`, so later TMDB synchronizations preserve data
owned by a future IMDb enrichment process. On newly inserted rows, those
nullable columns use their database defaults.

The normal discovery importer never reads from or writes to `daily_movies`. Reports use
"synchronized" terminology because an upsert response does not reliably
distinguish inserted rows from updated rows.
