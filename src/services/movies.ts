import { supabase } from '../lib/supabase';
import type { Movie } from '../types/movie';

const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

interface MovieRow {
  id: string;
  title: string;
  overview: string;
  poster_path: string;
  tmdb_rating: number | null;
  tmdb_vote_count: number;
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

export async function fetchFeaturedMovie(): Promise<Movie | null> {
  const { data, error } = await supabase
    .from('movies')
    .select('id, title, overview, poster_path, tmdb_rating, tmdb_vote_count')
    .not('tmdb_rating', 'is', null)
    .order('tmdb_vote_count', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to fetch the featured movie.');
  }

  return data === null ? null : mapMovieRow(data as MovieRow);
}
