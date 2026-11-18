import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loadDailyFixture } from './dailyMoviesFixture.ts';
import { localDailyDatabase, quote } from './localDailyMovies.ts';

// Local-only forward migration; never resets a database or changes the pool/calendar.
const fixture = loadDailyFixture();
const { sql } = localDailyDatabase(process.argv[2]);
const ids = fixture.schedule.map((row) => quote(row.id)).join(',');
assert.equal(sql(`select count(*) from public.movies where daily_recommendation_eligible;`), '60');
assert.equal(sql(`select count(*) from public.movies where id in (${ids}) and daily_recommendation_eligible;`), '60', 'prepare the verified manifest fixture first');
const expected = fixture.schedule.map((row) => `(${quote(row.scheduled_date)}::date,${quote(row.id)}::uuid)`).join(',');
assert.equal(sql(`select count(*) from (values ${expected}) e(day,movie) join public.daily_movies d on d.scheduled_date=e.day and d.movie_id=e.movie;`), '60');
const version = '20261112000001';
const migration = readFileSync(new URL('../migrations/' + version + '_add_weekly_personal_collections.sql', import.meta.url), 'utf8');
const applied = sql(`select count(*) from supabase_migrations.schema_migrations where version=${quote(version)};`) === '1';
if (applied) {
  assert.equal(sql(`select statements[1]=${quote(migration)} from supabase_migrations.schema_migrations where version=${quote(version)};`), 't', 'applied migration differs; never silently overwrite it');
} else {
  sql(`begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},'add_weekly_personal_collections',array[${quote(migration)}]); commit;`);
}
console.log(JSON.stringify({ localOnly: true, migration: version, alreadyApplied: applied, eligibleMovies: 60, matchingSharedDates: 60 }));
