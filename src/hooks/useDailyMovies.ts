import { useDailyMovieFeed } from './useDailyMovieFeed';

// Home has no dependency on the personal assignment service.
export function useDailyMovies() {
  return useDailyMovieFeed('shared');
}
