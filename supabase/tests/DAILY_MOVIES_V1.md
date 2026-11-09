# Personal daily movie V1 — local prototype

The authoritative pool is `fixtures/daily_movies_v1.manifest.json`, a byte-identical copy of the supplied `TrashMovies_60_Gun_Manifest.json`. It has 60 consecutive Istanbul dates, 2026-11-03 through 2027-01-01 inclusive, and 60 distinct movie UUIDs. SHA-256: `8aee0046811a21f51b65641d638d17440f0c81b1ae354adda47128bcb7d2bbc7`.

On 2026-11-06 all UUID/TMDB pairs, titles, dates, language, genres, TMDB ratings and vote counts matched the remote catalogue. The same-date remote calendar comparison had **zero differences**. Remote data was read only; it did not define pool membership. `daily_movies_v1.catalog.json` contains metadata for precisely those 60 films. The supplied editorial themes/reasons remain in the original manifest.

| Synthetic preference | After excluding disliked genres | Also matches any liked genre |
| --- | ---: | ---: |
| Comedy / not Horror | 34 | 19 |
| Action OR Science Fiction / not Horror | 34 | 20 |
| Drama / not Romance | 57 | 2 |
| Horror OR Thriller / not Comedy | 36 | 25 |
| Documentary / not Animation | 60 | 0 |

These counts use no user records. Liked genres rank candidates; they are not mandatory filters. Films tagged with any disliked genre are excluded even if another genre is liked.

## Local setup and validation

From `mobile/`, with the existing isolated PostgreSQL 17 test container:

```sh
node supabase/tests/prepare_daily_movies_local.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
node supabase/tests/daily_movies_local.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
node supabase/tests/daily_movies_concurrency.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
node --experimental-strip-types --test supabase/tests/daily_movies_manifest.test.ts
node --experimental-strip-types --test src/features/daily-movies/*.test.ts src/features/movie-taste/*.test.ts src/features/onboarding/*.test.ts
./node_modules/.bin/tsc --noEmit
npm run lint
```

The setup refuses URLs, non-test container names and nonlocal Docker sockets. It applies only the new migration through local `psql`, verifies its recorded contents on repeat runs, upserts the verified metadata/calendar, and enables exactly the manifest's 60 UUIDs. Other film rows are not made eligible. There is no remote push/reset command or credential in these fixtures. The calendar fixtures are fixed dates; shared-fallback database tests require server Istanbul today inside the manifest interval.

Enable `EXPO_PUBLIC_PERSONAL_DAILY_MOVIES_V1=1` only in the isolated app environment, with its local Supabase URL/key. Home always uses the shared calendar. The flag defaults off; the separate recommendations tab displays an unavailable message without requesting an assignment until V1 is enabled. Expo's virtual env module can import the existing root `.env` despite process overrides: use a disposable app copy with a local-only `.env`, separate Metro/cache, and inspect the served bundle **before opening it**. Preserve existing Metro/Docker resources.

## Assignment contract

- `movies.daily_recommendation_eligible` is explicit editorial approval, default false. The migration itself enables no films.
- `get_daily_movie_feed(p_expected_user_id)` derives ownership from `auth.uid()` and date from server `Europe/Istanbul`. The identity parameter is only a mismatch guard, never an ownership override. No client date parameter exists.
- A transaction advisory lock and `(user_id, scheduled_date)` primary key serialize first requests. Successful assignments are immutable through the authenticated API. RLS allows only owner reads and denies direct client writes.
- Existing assignments return without reading current taste. Only a new assignment reads the canonical `get_movie_taste()` snapshot and records its revision. Changing taste after today's assignment affects the next new assignment.
- Personal candidates require editorial approval and `adult=false`. Explicit disliked genres/films, watched movies and personal assignments in the previous 30 days are excluded. Ranking uses liked-genre overlap, then genre overlap with positively reacted films, then a deterministic user/date/movie tie break. Other Film Zevkim settings remain stored but do not influence this V1 ranker.
- If discovery is exhausted, only today's shared movie is considered. Explicit genre/film dislikes and the adult veto still apply. Watched/recent exclusions belong to personal discovery; the shared fallback may repeat a watched film. A successful fallback is persisted with `source=shared` and is equally stable.
- No candidate plus missing shared date returns `no_shared_movie`. An existing but vetoed shared film returns `no_candidate`. Neither invents an assignment. Database/transport errors propagate as errors and never become fallback/empty success responses.
- The RPC's latest 30 dates merge owner assignments over shared history, with one card per date. Past personal choices are never recomputed. The recommendations tab presents only today's result from this response, with distinct retryable empty/error states; a missing today is not replaced by a past date. Home independently reads shared `daily_movies` history and never overlays personal assignments. Both feeds and local card/modal state clear on account/session changes.
- Reveal RPCs/streak semantics are untouched: the current card flip is local UI and does not call `record_daily_movie_reveal`.

## Meaningful checks

The rollback SQL suite checks incompatible taste profiles, canonical Film Zevkim updates with same-day stability, original revision retention, RLS/identity/direct-write restrictions, watched/recent exclusions, 31-day eligibility, shared fallback and its explicit dislike veto, missing dates, unchanged historical overlays, zero liked matches, and injected database errors. A temporary failing taste reader proves that existing assignments do not read taste again; rollback restores all functions/data.

The concurrency runner opens two real PostgreSQL sessions. It observes the second session blocked by the first in `pg_stat_activity`/`pg_blocking_pids`, tests both first-session COMMIT and ROLLBACK, and verifies identical returned feeds and exactly one committed assignment. It cleans only its own temporary users.

Mobile tests cover payload/status validation, account switching with late responses, same-user logout/login generations, superseded requests, preserved history on refresh errors, and distinct empty reasons. Existing onboarding and Film Zevkim tests remain part of validation.

## Completed local validation — 2026-11-06

The continuation preserved the existing migration, RPC, Redux implementation, original manifest and verified metadata. The supplied Downloads manifest was rechecked: 60 consecutive dates and distinct UUIDs; the repository copy is byte-identical. A fresh GET-only comparison of the remote 2026-11-03–2027-01-01 calendar returned 60 identical date/UUID/TMDB/title matches and no extra rows. No remote write or migration was performed.

The remaining mobile fix gives the history controls a minimum height when today's navigation button is absent. This keeps the pagination/count visible in empty and error states. An old CI Metro transform cache initially served the previous styles; only test Metro 8084 was restarted with a new private cache. The served bundle was then checked for the final pagination style, strict response parser, local port 61021 target, enabled V1 flag and zero hosted-project URL occurrences.

Re-run results:

- **89/89** TypeScript/manifest tests passed.
- **30/30** personal daily database assertions passed, including same-day preference stability, explicit film/genre dislike vetoes and personal days without shared-calendar rows.
- **32/32** existing Film Zevkim database regression assertions passed.
- Both real concurrent first-request scenarios (**COMMIT and ROLLBACK**) passed with observed PostgreSQL blocking, identical returned feeds and one committed assignment.
- TypeScript `tsc --noEmit`, project lint and `git diff --check` passed.

iPhone 17 Pro / iOS 26.5 / Expo Go observations:

| Local profile/condition | Observed result |
| --- | --- |
| A: Comedy liked, Horror disliked | Personal **Home Sweet Home Alone**, original taste revision 0. |
| B: Horror liked, Comedy disliked | Personal **Mega Shark vs. Giant Octopus**; A's card absent. |
| C: all 60 personal candidates watched | Persistent shared **Plan 9 from Outer Space**. |
| D: all 60 watched and shared film's Horror genre disliked | No-candidate message; no assignment row; three historical cards remain. |
| D with today's local shared row temporarily absent | Distinct missing-shared message; past movie not presented as today. |
| D with local RPC execute permission temporarily revoked | Query-error message, not a fabricated empty/fallback result. |
| Final source after full Expo Go termination and explicit local project reopen | Local session preserved; correct empty status, history and **3/3** count visible. |

All three empty/error conditions were rechecked against the final uncached bundle with the 3/3 history count. Temporary calendar/permission changes were restored in `finally`; the local stack ends with 60 eligible films, 60 manifest calendar rows and authenticated RPC execution restored. Original Metro processes on 8081/8082/8083 remain running; only the dedicated 8084 test Metro was restarted. Screenshots and sanitized bundle/database checks are in `/private/tmp/trashmovies-daily-v1-ios/` (account credential files in that temporary test directory are not part of the repository).

The remaining deployment boundary is deliberate: V1 defaults off and all migrations/data changes stay local. No commit or push was made. Other Film Zevkim scales remain stored but are not ranking inputs in this V1; the ranker/exclusions are described above.

## Screen separation — 2026-11-06

This supersedes the earlier prototype's placement of personal results on Home. Home now reads only shared `daily_movies`, including the existing common history. The Expo Router `recommendations` tab ("Sana Özel") requests the existing personal service only while focused and presents today's single film with the existing card/actions. Its cached response cannot overwrite Home. Authentication changes clear both caches; late responses from a previous session cannot repopulate either one.

The personal service, SQL migration, fixtures and original tests were preserved byte for byte. Three additional reducer integration tests cover the shared/personal boundary and late account responses. All **92/92** Node tests, **30/30** personal database assertions, **32/32** Film Zevkim assertions, both real concurrency scenarios, TypeScript and lint passed.

Two fresh synthetic accounts were tested on iPhone 17 Pro / iOS 26.5 using a disposable local-only app and separate Metro **8085**, preserving ports 8081–8084. The served bundle contains Supabase `127.0.0.1:61021`, enabled V1 and no hosted-project URL. Maestro MCP listed the device but failed to inspect it; local Maestro CLI ran the UI assertions.

| Local taste | Home, observed | Sana Özel, observed |
| --- | --- | --- |
| A: likes Comedy, dislikes Horror | Plan 9 from Outer Space; common history 4/4 | Holiday on Mars (Comedy, Science Fiction) |
| B: likes Horror, dislikes Comedy | Plan 9 from Outer Space; common history 4/4 | Lawnmower Man 2: Beyond Cyberspace (Horror, Action, Thriller, Science Fiction) |

Local Kong access logs showed **zero** `get_daily_movie_feed` requests during each initial Home visit; each account had **zero** assignment rows before opening Sana Özel. Opening that tab made **one** RPC request per account and persisted one `source=personal` row each at taste revision 0. Returning to Home retained the common film and did not request a personal assignment. Account B never displayed account A's personal card. Sanitized database/request reports, CLI flows and screenshots are in `/private/tmp/trashmovies-tab-separation-ios/`; credentials remain outside the repository. No remote change, migration, commit or push was performed.

Additional UI assertions passed: B's recommendation card flipped to details and back; Home swiped to the shared November 5 film (Dragonball Evolution, 3/4), then "Bugüne dön" returned to Plan 9 from Outer Space (4/4). Both returns to Home recorded zero personal RPCs and one shared-calendar read each.

## Release review fixes — 2026-11-09

Today's recommendation now requires both the feed date and card date to match
the current Istanbul day, tracked separately from the cached server response.
The focused refresh timer aligns to minute boundaries (including Istanbul
midnight), and foreground/retry refreshes the date before waiting for a response.
Yesterday's card and empty-state reason disappear from today's selection as soon
as the day advances. Failed requests retain the feed history and show the
existing error/retry UI; successful retry displays only the new day's card.
Shared Home history is unaffected. Recommendations still present a single
current card, not a new personal-history screen.

The new `dayTransition.test.ts` uses a controlled clock, the real focus lifecycle,
Redux reducers and presentation selector. It passes exact 20:59:59.999Z →
21:00:00Z Istanbul-day rollover, pending request, failed request, preserved
personal/shared history and successful retry. Foreground after a suspended
midnight, blur cancellation/queued events and stale empty-state reasons are also
covered. All **95/95** Node/manifest tests, TypeScript, lint and diff checks pass.
These are automated lifecycle/state checks; no new native simulator E2E run was
performed. The earlier November 6 simulator evidence remains historical.

The separate [release SQL](../releases/20261109000001_enable_personal_daily_pool_v1.sql)
replaces the missing production pool-loading step without reusing the local
calendar/catalogue fixture writer. It validates and locks all 60 manifest UUIDs
before updating only their eligibility. Two real committed runs in disposable
local databases enabled 60 and then changed zero; all 60 shared calendar rows
and every column stayed identical. Metadata, genres, genre links and outside-pool
true/false values stayed unchanged. The missing-UUID case raised SQLSTATE 23503
and changed no rows. The runner removed both disposable DBs and confirmed the
original isolated DB remained unchanged. See [release instructions](../releases/README.md).

Both `mobile_reviewer` and `db_reviewer` inspected the fixes and found no blocker
in the requested normal-date transition or final release SQL. Their limits:
native UI timing and concurrent release/deletion were not newly exercised in
separate native/DB sessions. The device clock determines the displayed Istanbul
day; an incorrect device day can hide a successful server response's card.
Remote MCP still failed OAuth refresh, so remote history/permissions/calendar
were not reverified. No remote migration, loading SQL or flag activation ran.
