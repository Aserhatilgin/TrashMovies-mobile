# Weekly personal collection V1

Branch: `codex/weekly-personal-collection`. The new forward migration is
`20261112000001_add_weekly_personal_collections.sql`. No published migration,
legacy daily RPC, daily assignment, or shared-calendar membership is rewritten.

## Contract

`get_weekly_movie_collection(p_expected_user_id)` determines Monday–Sunday from
server `Europe/Istanbul` time. The identity argument only checks `auth.uid()`;
it cannot select another account. There is no client date parameter.

The first successful call obtains a transaction advisory lock for user/week,
reads the canonical normalized `get_movie_taste()` snapshot, and creates one
header plus zero to five distinct ordered items in the same transaction. The
header stores actual exposure date (`selected_on`), taste revision, and weekly
algorithm version **1**. The PK, composite FK, unique film constraint and five
positions also enforce ownership, uniqueness and size. Authenticated clients
have owner-only SELECT RLS and RPC execution; they cannot directly write either
table. The private clock helper has no API-role EXECUTE grant.

A persisted header, including a zero-item header, is final for that week.
Changing taste, watching a selected film, or changing the pool does not reroll
it. The next new week reads the latest taste. A query/write failure rolls back
both header and items and remains retryable; it never becomes empty success.

Candidates use the existing editorial `movies.daily_recommendation_eligible`
flag, loaded from the approved 60-UUID manifest. Adult films, explicitly disliked
films/genres, watched films and recent personal recommendations are excluded.
Liked genre overlap ranks first, followed by genre overlap with positive movie
reactions and a deterministic user/week/movie tie-break. Other taste fields
remain stored and have the same influence as in the existing V1 ranker.

**Repeat window: 30 calendar days, unchanged.** Exposure is the actual weekly
`selected_on`, not the Monday anchor. Weekly consumption of five films excludes
roughly 20–25 prior weekly films within that window, versus up to 30 prior daily
films. Both previous weekly collections and legacy personal daily assignments
(including today's) participate. Sparse genre pools and watched history can
leave fewer than five films. No exclusion is relaxed to fill the collection.
Weekly zero results are persisted and have **no shared-calendar fallback**;
Home continues to provide the shared film and shared history separately.

Legacy clients retain the existing `get_daily_movie_feed` behavior. Because
that frozen RPC does not read weekly records, a legacy daily request arriving
*after* a weekly collection may choose one of its films. Existing daily records
are excluded when creating the weekly collection. Weekly snapshots are not
rewritten retroactively to coordinate those old clients.

## Mobile

Sana Özel uses the existing feature flag and only requests the weekly RPC while
focused. Same-week focus/foreground/day changes reuse the immutable collection;
a new Istanbul week invalidates the visible old collection and requests anew.
A failed read shows retry; cached data remains in Redux, and only a collection
matching the visible week can be shown. Auth/session changes clear the cache
and reject late responses from the previous account/session.

The screen displays “Bu haftaki seçkin”, the server's dates, the actual 0–5 count,
and existing MovieCard/interaction controls. Interaction state independently
refreshes on focus. The existing rating modal is shared with the daily carousel.
All new text uses Translations and colors use the theme. Home still uses only
the shared daily service/store; it does not request a weekly or personal daily
assignment. A disabled flag does not mount the weekly data hook.

## Local validation

Use the disposable local setup from `README.md` and the manifest fixture setup
from `DAILY_MOVIES_V1.md`. Never point these commands at a hosted URL. The helper
accepts only the named isolated Docker test prefix and a local Docker socket.
It checks all 60 eligible UUIDs and exact calendar matches before applying the
new migration, and compares the recorded SQL on repeat runs. It does not seed,
reset, modify the pool/calendar, or silently overwrite an applied migration.

```sh
node --experimental-strip-types supabase/tests/prepare_weekly_movies_local.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
node --experimental-strip-types supabase/tests/weekly_movies_local.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
node --experimental-strip-types supabase/tests/weekly_movies_concurrency.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
node --experimental-strip-types supabase/tests/daily_movies_local.ts supabase_db_trashmovies-filmzevkim-test-ul19uw
node --experimental-strip-types --test src/features/weekly-movies/*.test.ts src/features/daily-movies/*.test.ts src/features/movie-taste/*.test.ts src/features/onboarding/*.test.ts scripts/tests/*.test.mjs supabase/tests/daily_movies_manifest.test.ts
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint . --no-cache
```

The weekly SQL test uses a rollback-only owner clock override. Its 50 assertions
cover 0/1/2/5 results, ranking/exclusions (including adult), captured revision,
same-week taste change, immutable empty results, Sunday/Monday, actual 30/31-day
exposure, today's legacy personal assignment, RLS/privileges/identity, query and
mid-item write failures, rollback/retry, and preservation of the entire shared
calendar, all legacy daily records and the exact old RPC definition. The
concurrency runner observes real PostgreSQL blocking in two sessions; both
first-writer COMMIT and ROLLBACK leave one five-film collection with equal return
payloads. Only its own synthetic users are removed.

The disposable Expo app is `/private/tmp/trashmovies-weekly-ios/app`, Metro8087,
loopback Supabase61021. The real application's ignored remote `.env` and existing
Metro8081 are preserved. Inspect the served iOS bundle before opening it: local
URL, flag1, and no hosted project URL. Test accounts/keys/evidence stay in private
temporary files, outside Git. Native test results are recorded below after the
actual simulator run; clock-driven Node tests are not native observations.

## Separate release step

1. Verify the prerequisite movie-taste and daily personalization migrations
   in the target environment; apply missing prerequisites only through a
   separately authorized release. Verify the approved 60-film pool/calendar
   before reviewing the new weekly migration. Hosted state was not checked
   as part of this local task.
2. Apply **only the new weekly forward migration** through the normal authorized
   release process, then verify tables, owner RLS, RPC grants and isolation.
3. Deploy the weekly client only after its RPC exists. This branch reuses the
   existing feature flag: an enabled old environment does not automatically
   acquire the new RPC. Keep the deployment order explicit.
4. Retain the legacy daily RPC/tables for old clients. Do not rerun the pool load
   or change the shared calendar as part of this weekly migration.

No hosted SQL/migration/data/feature-flag change, commit or push is part of this
local implementation task.

## Executed validation — 2026-11-12

- **109/109 Node tests**, TypeScript and lint passed on the final source.
- **50 weekly + 30 legacy daily + 32 movie-taste** PostgreSQL assertions passed
  in the isolated local DB. Weekly, daily and taste concurrency each passed
  real first-writer COMMIT/ROLLBACK cases: six scenarios total.
- `mobile_reviewer` and `db_reviewer` independently reviewed the final changes;
  no open blocker remained. Mobile review's stale interaction-state finding
  was fixed with focus refresh and then observed in the simulator. DB review's
  adult/legacy-write test suggestions and conditional release wording were added.

Actual native validation used **iPhone 17 Pro / iOS 26.2**, Expo Go8087 and
Supabase61021, with synthetic local accounts. Maestro MCP was unavailable;
Maestro CLI on Java17, simulator screenshots and guarded local Hermes/CDP
inspection supplied the evidence. These were real simulator runs:

| Scenario | Expected | Observed |
| --- | --- | --- |
| A/B initial visit | Separate five-film packages; common Home unchanged | A: Cats, Home Alone4, Lucky Luke and the Daltons, Disaster Movie, Baby Geniuses. B: Bats, Troll2, Lawnmower Man2, Lake Placid2, Plan9. Both Home screens: Starcrash, common history10/10. |
| Weekly list | Header, server range, actual count and all cards | “Bu haftaki seçkin”,9–15 November2026,5 films; scrolled to A's fifth card and back. |
| Same-week taste save + cold open | First package and captured revision stay fixed | Canonical taste revision0→1; complete returned weekly JSON, film order and captured revision0 remained equal after terminating/reopening Expo. |
| Account switch | Previous user's package cleared | Redux feed cleared; B's list contained no Cats card. Switching to the partial/empty accounts also removed B's card. |
| Interaction refresh | Updated actions without a new weekly assignment | While Home focused, local services saved/marked Cats watched. Returning to Sana Özel showed Kaydedildi/İzlendi; Kong delta:0 weekly RPC,1 interaction batch read. Calendar untouched. |
| Network error → retry | Error/retry with cache preserved; successful recovery | Weekly-only temporary fetch rejection showed error + Tekrar Dene with B's five films retained. Original fetch restored; native retry removed the error and restored success. |
| Two candidates | Exactly two films, no padding | “2 film”; Death Race2050 and Jiu Jitsu. |
| Zero candidates | Empty success, distinct from network/query error | “0 film” and the translated no-match message; runtime status empty, no error. |

Sunday–Monday boundary and concurrent first requests were verified by the actual
local SQL functions and controlled-clock Redux/lifecycle tests, **not by changing
the simulator/host clock**. The boundary regression hides the prior week's list
before a failed refresh, retains its cached data, and shows the new list only
after a successful retry.

The last two native scenarios were completed by the parent after `test_runner`
hit its usage limit; its earlier A/B, cold-open, focus and retry observations were
preserved. The first partial test attempt opened the Expo Go shell; changing only
the temporary Maestro flow to an explicit loopback project link resolved it.
Screenshots, runtime evidence and flows remain in
`/private/tmp/trashmovies-weekly-ios/`, outside Git. Temporary network injection
was removed. No hosted migration/data/flag change, commit or push was made.
