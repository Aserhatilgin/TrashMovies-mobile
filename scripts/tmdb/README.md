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
them, or print them. Supabase variables are read only when `--write` is chosen.
Before creating the administrative client, write mode verifies that
`SUPABASE_URL` has the exact `<SUPABASE_EXPECTED_PROJECT_REF>.supabase.co`
hostname. A mismatch fails locally without displaying environment values.
It also rejects an obviously public `SUPABASE_SERVICE_ROLE_KEY`, including
publishable keys and decodable JWTs whose role is `anon`. This is a local
configuration sanity check, not cryptographic verification.

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

The importer never reads from or writes to `daily_movies`. Reports use
"synchronized" terminology because an upsert response does not reliably
distinguish inserted rows from updated rows.
