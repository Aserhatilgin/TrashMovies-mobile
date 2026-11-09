import { supabase } from '../lib/supabase';
import type { DailyMovie, DailyMovieFeed, Movie } from '../types/movie';
import { PERSONAL_DAILY_MOVIES_V1_ENABLED } from '../constants/Features';
import { parseDailyMovieFeed } from '../features/daily-movies/model';
import { istanbulDate } from '../utils/istanbulDate';
export { istanbulDate } from '../utils/istanbulDate';

const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export function posterUrlFromPath(path: string): string {
  return `${TMDB_POSTER_BASE_URL}${path}`;
}

interface MovieRow {
  id: string;
  title: string;
  overview: string;
  poster_path: string;
  tmdb_rating: number | null;
}

interface DailyMovieRow {
  scheduled_date: string;
  movies: MovieRow;
}

function mapMovieRow(row: MovieRow): Movie {
  return {
    id: row.id,
    title: row.title,
    description: row.overview,
    posterUrl: posterUrlFromPath(row.poster_path),
    tmdbRating: row.tmdb_rating,
  };
}

export async function fetchDailyMoviesHistory(signal?: AbortSignal): Promise<DailyMovie[]> {
  const query = supabase
    .from('daily_movies')
    .select('scheduled_date, movies!daily_movies_movie_id_fkey(id, title, overview, poster_path, tmdb_rating)')
    .lte('scheduled_date', istanbulDate(new Date()))
    .order('scheduled_date', { ascending: false })
    .limit(30);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).overrideTypes<DailyMovieRow[]>();

  if (error) {
    throw new Error('Unable to fetch daily movie history.');
  }

  return (data ?? []).map((row) => ({
    scheduledDate: row.scheduled_date,
    movie: mapMovieRow(row.movies),
  })).reverse();
}

export async function fetchDailyMovieFeed(userId: string, signal?: AbortSignal): Promise<DailyMovieFeed> {
  if (!PERSONAL_DAILY_MOVIES_V1_ENABLED) {
    return { userId, today: istanbulDate(new Date()), status: 'legacy', items: await fetchDailyMoviesHistory(signal) };
  }
  const query = supabase.rpc('get_daily_movie_feed', { p_expected_user_id: userId });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  // A query/transport failure is never converted into an empty candidate pool.
  if (error) throw new Error('Unable to fetch personal daily movie feed.');
  return parseDailyMovieFeed(data, userId, posterUrlFromPath);
}
