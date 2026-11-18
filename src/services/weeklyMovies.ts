import { supabase } from '../lib/supabase';
import { parseWeeklyMovieCollection } from '../features/weekly-movies/model';
import { posterUrlFromPath } from './movies';
import type { WeeklyMovieCollection } from '../types/weeklyMovies';

export async function fetchWeeklyMovieCollection(userId: string, signal?: AbortSignal): Promise<WeeklyMovieCollection> {
  const query = supabase.rpc('get_weekly_movie_collection', { p_expected_user_id: userId });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  return parseWeeklyMovieCollection(data, userId, posterUrlFromPath);
}
