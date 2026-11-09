import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loadDailyFixture } from './dailyMoviesFixture.ts';
import { localDailyDatabase, psqlArgs, quote } from './localDailyMovies.ts';

// Never connects to a URL. All writes occur in disposable DBs inside the named
// isolated local test container, never its original postgres database.
const db = localDailyDatabase(process.argv[2]);
const fixture = loadDailyFixture();
const release = readFileSync(new URL('../releases/20261109000001_enable_personal_daily_pool_v1.sql', import.meta.url), 'utf8');
const releaseIds = [...release.matchAll(/'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/g)].map((match) => match[1]);
assert.equal(releaseIds.length, 60);
assert.deepEqual([...releaseIds].sort(), fixture.movies.map((movie) => movie.id).sort());
assert.ok(release.includes(fixture.manifestSha256));
const ids = releaseIds.map(quote).join(',');
const databaseNames: string[] = [];
function createDatabase() {
  const name = 'trashmovies_release_pool_' + randomBytes(8).toString('hex');
  assert.match(name, /^trashmovies_release_pool_[0-9a-f]+$/);
  db.sql(`create database "${name}" template template0;`);
  databaseNames.push(name);
  return (query: string): string => execFileSync('docker', [
    '--context', 'desktop-linux', 'exec', '-i', db.container!, ...psqlArgs.slice(0, -1), name,
  ], { input: query, encoding: 'utf8', timeout: 20_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function snapshot(sql: (query: string) => string) {
  return {
    movies: sql("select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('row_xmin',m.xmin::text) order by m.id),'[]') from public.movies m;"),
    calendar: sql("select coalesce(jsonb_agg(to_jsonb(d) order by d.scheduled_date),'[]') from public.daily_movies d;"),
    genres: sql("select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from public.genres g;"),
    movieGenres: sql("select coalesce(jsonb_agg(to_jsonb(g) order by g.movie_id,g.genre_id),'[]') from public.movie_genres g;"),
  };
}
const original = snapshot(db.sql);
function initializeCatalog(sql: (query: string) => string) {
  const catalogDdl = readFileSync(new URL('../migrations/20260810090703_create_movie_catalog.sql', import.meta.url), 'utf8');
  const eligibilityDdl = readFileSync(new URL('../migrations/20261106000001_add_personal_daily_movies.sql', import.meta.url), 'utf8')
    .match(/^alter table public\.movies add column daily_recommendation_eligible[^;]+;/m)?.[0];
  assert.ok(eligibilityDdl, 'the real eligibility column DDL must be present');
  sql('create table public.movies(id uuid);' + catalogDdl + eligibilityDdl);
}
try {
  const sql = createDatabase();
  initializeCatalog(sql);
  // Copy read-only snapshots instead of cloning a live DB or terminating sessions.
  // jsonb_populate_recordset ignores the observational row_xmin field.
  for (const [table, rows] of [
    ['movies', original.movies], ['genres', original.genres],
    ['movie_genres', original.movieGenres], ['daily_movies', original.calendar],
  ]) sql(`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},${quote(rows)}::jsonb);`);
  assert.equal(sql(`select count(*) from public.movies where id in (${ids});`), '60');
  sql(`update public.movies set daily_recommendation_eligible=false where id in (${ids});`);
  // An already-enabled nonmanifest film must survive untouched.
  const sentinel = randomUUID(), disabledSentinel = randomUUID();
  sql(`insert into public.movies(id,tmdb_id,title,original_title,overview,poster_path,daily_recommendation_eligible)
    values (${quote(sentinel)},9000000000000000,'Release test','Release test','Disposable fixture','/fixture.jpg',true),
    (${quote(disabledSentinel)},9000000000000001,'Disabled fixture','Disabled fixture','Disposable fixture','/fixture.jpg',false);`);
  const before = snapshot(sql);
  sql(release); // Real BEGIN/COMMIT, first execution.
  const first = snapshot(sql);
  assert.equal(sql(`select count(*) from public.movies where id in (${ids}) and daily_recommendation_eligible;`), '60');
  assert.equal(first.calendar, before.calendar, 'all shared calendar rows/columns must be byte-identical after first execution');
  assert.equal(first.genres, before.genres, 'genre metadata changed');
  assert.equal(first.movieGenres, before.movieGenres, 'genre links changed');
  const moviesBefore = JSON.parse(before.movies) as Record<string, unknown>[];
  const moviesAfter = JSON.parse(first.movies) as Record<string, unknown>[];
  let changed = 0;
  for (const movie of moviesBefore) {
    const after = moviesAfter.find((row) => row.id === movie.id)!;
    if (releaseIds.includes(String(movie.id))) {
      assert.equal(after.daily_recommendation_eligible, true);
      assert.notEqual(after.row_xmin, movie.row_xmin);
      const metadata = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row)
        .filter(([key]) => !['daily_recommendation_eligible', 'updated_at', 'row_xmin'].includes(key)));
      assert.deepEqual(metadata(after), metadata(movie), 'release must not overwrite movie metadata');
      changed++;
    } else assert.deepEqual(after, movie, 'nonmanifest movie changed');
  }
  assert.equal(changed, 60);
  sql(release); // Second committed execution, without resetting any data.
  const second = snapshot(sql);
  assert.deepEqual(second, first, 'second execution must not update rows, timestamps or xmin');
  assert.equal(second.calendar, before.calendar, 'all shared calendar rows/columns must be byte-identical after second execution');
  console.log(JSON.stringify({ scenario: 'two_committed_runs', firstEnabled: changed, secondChanged: 0,
    sharedRows: JSON.parse(before.calendar).length, sharedCalendarSha256: createHash('sha256').update(before.calendar).digest('hex'),
    sharedCalendarExactlyPreserved: true, outsideManifestAndMetadataPreserved: true }));

  // Negative case uses the real catalogue DDL in another disposable DB, with
  // one requested UUID deliberately absent. No FK bypass or remote fixture writes.
  const missingSql = createDatabase();
  initializeCatalog(missingSql);
  const missing = releaseIds[releaseIds.length - 1];
  const value = (v: string | number | boolean | null): string => v === null ? 'null' : typeof v === 'string' ? quote(v) : String(v);
  const columns = Object.keys(fixture.movies[0]) as (keyof typeof fixture.movies[number])[];
  missingSql(`insert into public.movies(${columns.join(',')}) values ${fixture.movies.filter((movie) => movie.id !== missing).map((movie) =>
    '(' + columns.map((key) => value(movie[key])).join(',') + ')').join(',')};
    insert into public.daily_movies(scheduled_date,movie_id) values ${fixture.schedule.filter((row) => row.id !== missing)
      .map((row) => `(${quote(row.scheduled_date)},${quote(row.id)})`).join(',')};`);
  const beforeFailure = snapshot(missingSql);
  assert.throws(() => missingSql('\\set VERBOSITY verbose\n' + release), (error: unknown) => {
    assert.ok(error instanceof Error && 'stderr' in error);
    assert.match(String(error.stderr), /requires 60 locked catalog UUIDs/);
    assert.match(String(error.stderr), /23503/);
    assert.ok(String(error.stderr).includes(missing));
    return true;
  });
  assert.deepEqual(snapshot(missingSql), beforeFailure, 'missing UUID must leave every catalogue/calendar row and xmin unchanged');
  assert.equal(missingSql('select count(*) from public.movies where daily_recommendation_eligible;'), '0');
  console.log(JSON.stringify({ scenario: 'missing_catalog_uuid', missing, rejectedBeforeUpdate: true, catalogAndCalendarExactlyPreserved: true }));
} finally {
  for (const name of databaseNames.reverse()) db.sql(`drop database "${name}" with (force);`);
  assert.deepEqual(snapshot(db.sql), original, 'original isolated database must remain exactly unchanged');
  console.log(JSON.stringify({ originalIsolatedDatabaseUnchanged: true, disposableDatabasesRemoved: databaseNames.length }));
}
