import type { DailyMovieFeed } from '../types/movie';
import { createDailyFeedSlice } from '../features/daily-movies/createDailyFeedSlice.ts';

export interface SharedDailyMovieServices {
  fetchSharedDailyMovieFeed: (userId: string, signal?: AbortSignal) => Promise<DailyMovieFeed>;
}
const shared = createDailyFeedSlice('sharedDailyMovies',
  (services: SharedDailyMovieServices, userId, signal) => services.fetchSharedDailyMovieFeed(userId, signal));
export const loadSharedDailyMovies = shared.load;
export default shared.reducer;
