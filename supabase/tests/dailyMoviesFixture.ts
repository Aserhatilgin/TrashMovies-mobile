import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

interface ManifestEntry { scheduled_date: string; id: string; tmdb_id: number; title: string }
interface CatalogMovie {
  id: string; tmdb_id: number; imdb_id: string | null; title: string; original_title: string;
  overview: string; poster_path: string; backdrop_path: string | null; release_date: string | null;
  original_language: string | null; tmdb_rating: number | null; tmdb_vote_count: number;
  imdb_rating: number | null; popularity: number | null; adult: boolean;
}
export interface DailyFixture {
  manifestSha256: string;
  schedule: ManifestEntry[];
  movies: CatalogMovie[];
  genres: { id: string; tmdb_id: number; name: string; slug: string }[];
  movie_genres: { movie_id: string; genre_id: string }[];
}
export function loadDailyFixture(): DailyFixture {
  const original = readFileSync(new URL('./fixtures/daily_movies_v1.manifest.json', import.meta.url));
  const manifest = JSON.parse(original.toString()) as { start_date: string; end_date: string; timezone: string; schedule: ManifestEntry[] };
  const catalog = JSON.parse(readFileSync(new URL('./fixtures/daily_movies_v1.catalog.json', import.meta.url), 'utf8')) as {
    manifest_sha256: string; movies: CatalogMovie[]; genres: DailyFixture['genres']; movie_genres: DailyFixture['movie_genres'];
  };
  const digest = createHash('sha256').update(original).digest('hex');
  assert.equal(digest, '8aee0046811a21f51b65641d638d17440f0c81b1ae354adda47128bcb7d2bbc7', 'supplied editorial manifest must remain byte-identical');
  assert.equal(catalog.manifest_sha256, digest);
  assert.equal(manifest.start_date, '2026-11-03'); assert.equal(manifest.end_date, '2027-01-01');
  assert.equal(manifest.timezone, 'Europe/Istanbul'); assert.equal(manifest.schedule.length, 60);
  assert.equal(new Set(manifest.schedule.map((r) => r.id)).size, 60, '60 distinct film UUIDs');
  assert.equal(new Set(manifest.schedule.map((r) => r.scheduled_date)).size, 60);
  assert.equal(catalog.movies.length, 60); assert.equal(new Set(catalog.movies.map((m) => m.id)).size, 60);
  const genreIds = new Set(catalog.genres.map((g) => g.id));
  for (let i = 0; i < 60; i++) {
    const row = manifest.schedule[i];
    assert.equal(row.scheduled_date, new Date(Date.UTC(2026, 10, 3 + i)).toISOString().slice(0, 10));
    assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const movie = catalog.movies.find((m) => m.id === row.id);
    assert.ok(movie); assert.equal(movie.tmdb_id, row.tmdb_id); assert.equal(movie.title, row.title);
    assert.equal(movie.adult, false); assert.ok(movie.overview && movie.poster_path);
    assert.ok(catalog.movie_genres.some((g) => g.movie_id === movie.id), 'verified movie must have genre metadata');
  }
  assert.ok(catalog.movie_genres.every((g) => genreIds.has(g.genre_id) && catalog.movies.some((m) => m.id === g.movie_id)));
  return { manifestSha256: digest, schedule: manifest.schedule, movies: catalog.movies, genres: catalog.genres, movie_genres: catalog.movie_genres };
}
