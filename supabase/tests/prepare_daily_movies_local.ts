import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loadDailyFixture } from './dailyMoviesFixture.ts';
import { localDailyDatabase, quote } from './localDailyMovies.ts';

// No URLs, remote clients, CLI link/push/reset, credentials, or network writes.
const fixture = loadDailyFixture();
const { sql } = localDailyDatabase(process.argv[2]);
const version = '20261106000001';
const migration = readFileSync(new URL('../migrations/' + version + '_add_personal_daily_movies.sql', import.meta.url), 'utf8');
const applied = sql(`select count(*) from supabase_migrations.schema_migrations where version=${quote(version)};`) === '1';
if (!applied) {
  sql(`begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
    values (${quote(version)},'add_personal_daily_movies',array[${quote(migration)}]); commit;`);
} else {
  assert.equal(sql(`select statements[1] = ${quote(migration)} from supabase_migrations.schema_migrations where version=${quote(version)};`), 't', 'applied migration differs; do not silently overwrite it');
}
const value = (v: string | number | boolean | null): string => v === null ? 'null'
  : typeof v === 'string' ? quote(v) : String(v);
const columns = Object.keys(fixture.movies[0]) as (keyof typeof fixture.movies[number])[];
const ids = fixture.movies.map((m) => quote(m.id)).join(',');
sql(`begin;
  insert into public.genres(id,tmdb_id,name,slug) values ${fixture.genres.map((g) =>
    '(' + [g.id,g.tmdb_id,g.name,g.slug].map(value).join(',') + ')').join(',')}
  on conflict(id) do update set name=excluded.name,slug=excluded.slug;
  insert into public.movies(${columns.join(',')}) values ${fixture.movies.map((m) =>
    '(' + columns.map((k) => value(m[k])).join(',') + ')').join(',')}
  on conflict(id) do update set ${columns.filter((k) => k !== 'id').map((k) => `${k}=excluded.${k}`).join(',')};
  delete from public.movie_genres where movie_id in (${ids});
  insert into public.movie_genres(movie_id,genre_id) values ${fixture.movie_genres.map((g) => `(${quote(g.movie_id)},${quote(g.genre_id)})`).join(',')};
  update public.movies set daily_recommendation_eligible = (id in (${ids}));
  insert into public.daily_movies(scheduled_date,movie_id) values ${fixture.schedule.map((r) => `(${quote(r.scheduled_date)},${quote(r.id)})`).join(',')}
  on conflict(scheduled_date) do update set movie_id=excluded.movie_id;
  commit;`);
assert.equal(sql('select count(*) from public.movies where daily_recommendation_eligible;'), '60');
assert.equal(sql(`select count(*) from public.daily_movies where scheduled_date between '2026-11-03' and '2027-01-01' and movie_id in (${ids});`), '60');
console.log(JSON.stringify({ localOnly: true, manifestSha256: fixture.manifestSha256, eligibleMovies: 60, sharedDates: 60, genreEdges: fixture.movie_genres.length, migration: version }));
