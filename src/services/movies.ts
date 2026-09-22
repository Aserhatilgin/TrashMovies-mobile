import { supabase } from '../lib/supabase';
import type { DailyMovie, Movie } from '../types/movie';

const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

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

function istanbulDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function mapMovieRow(row: MovieRow): Movie {
  return {
    id: row.id,
    title: row.title,
    description: row.overview,
    posterUrl: `${TMDB_POSTER_BASE_URL}${row.poster_path}`,
    tmdbRating: row.tmdb_rating,
  };
}

export async function fetchDailyMoviesHistory(): Promise<DailyMovie[]> {
  const { data, error } = await supabase
    .from('daily_movies')
    .select('scheduled_date, movies!daily_movies_movie_id_fkey(id, title, overview, poster_path, tmdb_rating)')
    .lte('scheduled_date', istanbulDate(new Date()))
    .order('scheduled_date', { ascending: false })
    .limit(30)
    .overrideTypes<DailyMovieRow[]>();

  if (error) {
    throw new Error('Unable to fetch daily movie history.');
  }

  return (data ?? []).map((row) => ({
    scheduledDate: row.scheduled_date,
    movie: mapMovieRow(row.movies),
  })).reverse();
}
