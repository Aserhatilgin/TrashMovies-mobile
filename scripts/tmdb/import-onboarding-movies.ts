import { loadImportConfig } from './config.ts';
import { normalizeGenres, normalizeMovie } from './normalize-movie.ts';
import {
  SupabaseCatalogWriter,
  type CatalogMovieRow,
  type DailyMoviesSnapshot,
} from './supabase-writer.ts';
import { TmdbClient } from './tmdb-client.ts';
import type { AcceptedMovie } from './types.ts';

const onboardingMovies = [
  { tmdbId: 155, title: 'The Dark Knight', year: 2008 },
  { tmdbId: 157336, title: 'Interstellar', year: 2014 },
  { tmdbId: 138843, title: 'The Conjuring', year: 2013 },
  { tmdbId: 313369, title: 'La La Land', year: 2016 },
  { tmdbId: 120467, title: 'The Grand Budapest Hotel', year: 2014 },
  { tmdbId: 496243, title: 'Parasite', year: 2019 },
  { tmdbId: 129, title: 'Spirited Away', year: 2001 },
  { tmdbId: 238, title: 'The Godfather', year: 1972 },
  { tmdbId: 37165, title: 'The Truman Show', year: 1998 },
  { tmdbId: 76341, title: 'Mad Max: Fury Road', year: 2015 },
  { tmdbId: 244786, title: 'Whiplash', year: 2014 },
  { tmdbId: 11036, title: 'The Notebook', year: 2004 },
  { tmdbId: 419430, title: 'Get Out', year: 2017 },
  { tmdbId: 545611, title: 'Everything Everywhere All at Once', year: 2022 },
] as const;
const theRoom = { tmdbId: 17473, title: 'The Room', year: 2003 } as const;
const allMovies = [...onboardingMovies, theRoom];

function matchesIdentity(
  actualTitle: string,
  actualDate: string | null,
  expected: { title: string; year: number },
): boolean {
  return actualTitle.normalize('NFKC').trim().toLowerCase() ===
      expected.title.normalize('NFKC').trim().toLowerCase() &&
    actualDate?.slice(0, 4) === String(expected.year);
}

function catalogMap(rows: CatalogMovieRow[]): Map<number, CatalogMovieRow> {
  const byTmdbId = new Map(rows.map((row) => [Number(row.tmdb_id), row]));
  if (byTmdbId.size !== rows.length) {
    throw new Error('Supabase returned duplicate TMDB movie IDs.');
  }
  return byTmdbId;
}

function verifyCatalogIdentity(
  rows: CatalogMovieRow[],
  requireAll: boolean,
): Map<number, CatalogMovieRow> {
  const byTmdbId = catalogMap(rows);
  for (const expected of allMovies) {
    const row = byTmdbId.get(expected.tmdbId);
    if (!row) {
      if (requireAll || expected.tmdbId === theRoom.tmdbId) {
        throw new Error(`Expected TMDB movie ${expected.tmdbId} is missing from Supabase.`);
      }
      continue;
    }
    if (!matchesIdentity(row.title, row.release_date, expected)) {
      throw new Error(`Supabase movie ${expected.tmdbId} has an unexpected title or year.`);
    }
  }
  return byTmdbId;
}

function sameDailySnapshot(before: DailyMoviesSnapshot, after: DailyMoviesSnapshot): void {
  if (before.count !== after.count || before.sha256 !== after.sha256) {
    throw new Error('daily_movies changed during the catalog write; inspect remote changes.');
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if ((mode !== '--dry-run' && mode !== '--write') || process.argv.length !== 3) {
    throw new Error('Choose exactly one mode: --dry-run or --write.');
  }

  // Validate the same administrative project and credentials as the existing writer.
  // This script uses them for read-only presence checks even in dry-run mode.
  const config = loadImportConfig(['--write']);
  if (config.mode !== 'write') throw new Error('Administrative configuration is required.');
  const tmdb = new TmdbClient(config.tmdbReadAccessToken);
  const writer = new SupabaseCatalogWriter(config.supabaseUrl, config.supabaseServiceRoleKey);
  const genresByTmdbId = normalizeGenres(await tmdb.fetchMovieGenres());
  const beforeRows = await writer.readMoviesByTmdbIds(allMovies.map((movie) => movie.tmdbId));
  const before = verifyCatalogIdentity(beforeRows, false);
  const accepted: AcceptedMovie[] = [];

  for (const expected of onboardingMovies) {
    const details = await tmdb.fetchMovieDetails(expected.tmdbId);
    const result = normalizeMovie(details, genresByTmdbId, false);
    if (!result.accepted) {
      throw new Error(
        `TMDB movie ${expected.tmdbId} failed catalog validation: ${result.value.reasons.join(', ')}.`,
      );
    }
    const { movie, genres } = result.value;
    if (!matchesIdentity(movie.title, movie.release_date, expected)) {
      throw new Error(`TMDB movie ${expected.tmdbId} has an unexpected title or year.`);
    }
    if (genres.length === 0) {
      throw new Error(`TMDB movie ${expected.tmdbId} has no catalog genres.`);
    }
    accepted.push(result.value);
    console.log(JSON.stringify({
      tmdb_id: movie.tmdb_id,
      title: movie.title,
      release_date: movie.release_date,
      already_present: before.has(movie.tmdb_id),
      action: before.has(movie.tmdb_id) ? 'update' : 'insert',
      genres: genres.map((genre) => genre.name),
    }));
  }

  const dryRunDaily = await writer.readDailyMoviesSnapshot();
  console.log(JSON.stringify({
    preflight: 'clean',
    proposed_inserts: onboardingMovies.length - [...before.keys()].filter(
      (tmdbId) => tmdbId !== theRoom.tmdbId,
    ).length,
    proposed_updates: [...before.keys()].filter((tmdbId) => tmdbId !== theRoom.tmdbId).length,
    daily_movies_before: dryRunDaily,
  }));
  if (mode === '--dry-run') {
    console.log('Dry run complete: no Supabase writes were issued.');
    return;
  }

  const writeReport = await writer.synchronize(accepted);
  if (writeReport.failures.length > 0 || writeReport.moviesSynchronized !== accepted.length) {
    throw new Error('Catalog synchronization did not complete for all 14 movies.');
  }

  const afterRows = await writer.readMoviesByTmdbIds(allMovies.map((movie) => movie.tmdbId));
  const after = verifyCatalogIdentity(afterRows, true);
  if (after.size !== allMovies.length) {
    throw new Error('Supabase did not return exactly 15 onboarding movies.');
  }
  for (const [tmdbId, row] of before) {
    const current = after.get(tmdbId);
    if (
      !current || current.id !== row.id ||
      current.imdb_id !== row.imdb_id ||
      current.imdb_rating !== row.imdb_rating
    ) {
      throw new Error(`Catalog identity or IMDb-owned fields changed for ${tmdbId}.`);
    }
  }

  const relationships = await writer.readMovieGenreRelationships(
    accepted.map(({ movie }) => after.get(movie.tmdb_id)!.id),
  );
  const relationKeys = new Set(relationships.map((row) => `${row.movie_id}:${row.genre_id}`));
  const expectedRelationshipCount = accepted.reduce((count, item) => count + item.genres.length, 0);
  if (
    relationKeys.size !== relationships.length ||
    relationships.length !== expectedRelationshipCount ||
    writeReport.movieGenreRelationshipsSynchronized !== expectedRelationshipCount
  ) {
    throw new Error('Movie-genre relationship counts differ from TMDB details.');
  }

  const afterDaily = await writer.readDailyMoviesSnapshot();
  sameDailySnapshot(dryRunDaily, afterDaily);
  console.log(JSON.stringify({
    write: 'complete',
    imported: onboardingMovies.filter((movie) => !before.has(movie.tmdbId)).length,
    already_existing: onboardingMovies.filter((movie) => before.has(movie.tmdbId)).length,
    genres_synchronized: writeReport.genresSynchronized,
    movie_genres: relationships.length,
    daily_movies_after: afterDaily,
    daily_movies_unchanged: true,
  }));
  for (const expected of allMovies) {
    const row = after.get(expected.tmdbId)!;
    console.log(JSON.stringify({
      uuid: row.id,
      tmdb_id: row.tmdb_id,
      title: row.title,
      release_date: row.release_date,
    }));
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown import error.';
  console.error(`Onboarding catalog import failed: ${message}`);
  process.exitCode = 1;
});
