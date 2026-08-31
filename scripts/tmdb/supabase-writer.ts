import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type {
  AcceptedMovie,
  NormalizedGenre,
  NormalizedMovie,
  WriteFailure,
  WriteReport,
} from './types.ts';

interface IdByTmdbIdRow {
  id: string;
  tmdb_id: number;
}

interface MovieGenreRow {
  movie_id: string;
  genre_id: string;
}

function failure(operation: string): WriteFailure {
  return {
    operation,
    message: 'Supabase rejected the operation. No credentials or server details are shown.',
  };
}

function uniqueGenres(movies: AcceptedMovie[]): NormalizedGenre[] {
  const genres = new Map<number, NormalizedGenre>();
  for (const accepted of movies) {
    for (const genre of accepted.genres) genres.set(genre.tmdb_id, genre);
  }
  return [...genres.values()];
}

function idMap(rows: IdByTmdbIdRow[]): Map<number, string> {
  return new Map(rows.map((row) => [Number(row.tmdb_id), row.id]));
}

function tmdbOwnedMovieRow(movie: NormalizedMovie): NormalizedMovie {
  return {
    tmdb_id: movie.tmdb_id,
    title: movie.title,
    original_title: movie.original_title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date,
    original_language: movie.original_language,
    tmdb_rating: movie.tmdb_rating,
    tmdb_vote_count: movie.tmdb_vote_count,
    popularity: movie.popularity,
    adult: movie.adult,
  };
}

export class SupabaseCatalogWriter {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    try {
      this.client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } catch {
      throw new Error('Could not initialize the administrative Supabase client.');
    }
  }

  async synchronize(movies: AcceptedMovie[]): Promise<WriteReport> {
    const report: WriteReport = {
      moviesSynchronized: 0,
      genresSynchronized: 0,
      movieGenreRelationshipsSynchronized: 0,
      failures: [],
    };
    const genres = uniqueGenres(movies);
    const genreResult = await this.client
      .from('genres')
      .upsert(genres, { onConflict: 'tmdb_id' })
      .select('id, tmdb_id');

    if (genreResult.error || !genreResult.data) {
      report.failures.push(failure('synchronize genres'));
      return report;
    }

    report.genresSynchronized = genreResult.data.length;
    const genreIds = idMap(genreResult.data as IdByTmdbIdRow[]);
    const movieRows = movies.map(({ movie }) => tmdbOwnedMovieRow(movie));
    const movieResult = await this.client
      .from('movies')
      .upsert(movieRows, { onConflict: 'tmdb_id' })
      .select('id, tmdb_id');

    if (movieResult.error || !movieResult.data) {
      report.failures.push(failure('synchronize movies'));
      return report;
    }

    report.moviesSynchronized = movieResult.data.length;
    const movieIds = idMap(movieResult.data as IdByTmdbIdRow[]);

    for (const accepted of movies) {
      const movieId = movieIds.get(accepted.movie.tmdb_id);
      const desiredGenreIds = accepted.genres.map((genre) => genreIds.get(genre.tmdb_id));

      if (!movieId || desiredGenreIds.some((id) => id === undefined)) {
        report.failures.push(failure(`resolve relationships for TMDB movie ${accepted.movie.tmdb_id}`));
        continue;
      }

      const resolvedGenreIds = desiredGenreIds as string[];
      const existingResult = await this.client
        .from('movie_genres')
        .select('movie_id, genre_id')
        .eq('movie_id', movieId);

      if (existingResult.error || !existingResult.data) {
        report.failures.push(failure(`read relationships for TMDB movie ${accepted.movie.tmdb_id}`));
        continue;
      }

      const desired = new Set(resolvedGenreIds);
      const existing = existingResult.data as MovieGenreRow[];
      const staleIds = existing
        .map((row) => row.genre_id)
        .filter((genreId) => !desired.has(genreId));
      const relationships = resolvedGenreIds.map((genreId) => ({
        movie_id: movieId,
        genre_id: genreId,
      }));

      if (relationships.length > 0) {
        const upsertResult = await this.client
          .from('movie_genres')
          .upsert(relationships, { onConflict: 'movie_id,genre_id' });
        if (upsertResult.error) {
          report.failures.push(failure(`upsert relationships for TMDB movie ${accepted.movie.tmdb_id}`));
          continue;
        }
      }

      if (staleIds.length > 0) {
        const deleteResult = await this.client
          .from('movie_genres')
          .delete()
          .eq('movie_id', movieId)
          .in('genre_id', staleIds);
        if (deleteResult.error) {
          report.failures.push(failure(`remove stale relationships for TMDB movie ${accepted.movie.tmdb_id}`));
          continue;
        }
      }

      report.movieGenreRelationshipsSynchronized += relationships.length;
    }

    return report;
  }
}
