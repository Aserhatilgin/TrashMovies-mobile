# TMDB dry-run importer

Phase 1 fetches, filters, and normalizes TMDB movie candidates. It prints a
sanitized report and has no Supabase dependency or write path.

## Configuration

Copy the example file and add your own TMDB API Read Access Token:

```bash
cp .env.import.example .env.import.local
```

`TMDB_READ_ACCESS_TOKEN` is an importer-only secret. Never prefix it with
`EXPO_PUBLIC_`, commit it, print it, or import this script from `src/`.

## Five-movie dry run

From the `mobile/` directory, using Node.js 24:

```bash
node --env-file=.env.import.local scripts/tmdb/import-movies.ts --limit=5 --dry-run
```

`--limit` counts accepted movies rather than raw TMDB candidates. Phase 1
requires `--dry-run` and rejects all write-mode or unknown arguments.
