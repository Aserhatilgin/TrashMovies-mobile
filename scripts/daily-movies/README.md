# Daily movie schedule seeder

Run from `mobile/` with Node.js 24. The existing ignored admin environment file is `.env.import.local`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_EXPECTED_PROJECT_REF` there. This script does not need a TMDB token.

Preview all missing dates and proposed movies without writing:

```bash
node --env-file=.env.import.local scripts/daily-movies/seed-daily-movies.ts --dry-run
```

After reviewing the preview, explicitly insert missing dates:

```bash
node --env-file=.env.import.local scripts/daily-movies/seed-daily-movies.ts --write
```

The range is Istanbul today minus 29 days through today plus 30 days. Existing dates are preserved. Candidates are chosen in TMDB ID order, excluding movies already assigned in the range. Each insert uses the date primary key; a concurrent assignment is preserved.
