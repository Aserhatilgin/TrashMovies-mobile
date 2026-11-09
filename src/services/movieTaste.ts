import { parseMovieTaste } from '../features/movie-taste/model';
import { supabase } from '../lib/supabase';
import type { MovieTasteSnapshot, MovieTasteValues } from '../types/movieTaste';
import { posterUrlFromPath } from './movies';

export async function fetchMovieTaste(signal?: AbortSignal): Promise<MovieTasteSnapshot> {
  const query = supabase.rpc('get_movie_taste');
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  return parseMovieTaste(data, posterUrlFromPath);
}

export async function saveMovieTaste(userId: string, revision: number, preferences: MovieTasteValues,
  signal?: AbortSignal): Promise<MovieTasteSnapshot> {
  const query = supabase.rpc('save_movie_taste', {
    p_expected_user_id: userId, p_expected_revision: revision, p_preferences: preferences,
  });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  return parseMovieTaste(data, posterUrlFromPath);
}
