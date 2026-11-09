import { useDailyMovieFeed } from './useDailyMovieFeed';

export function usePersonalDailyMovies() {
  return useDailyMovieFeed('personal');
}
