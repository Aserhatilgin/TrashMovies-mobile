import type { DailyMovieFeed } from '../types/movie';
import { createDailyFeedSlice } from '../features/daily-movies/createDailyFeedSlice.ts';
export type { DailyMoviesState } from '../features/daily-movies/createDailyFeedSlice';

export interface DailyMovieServices {
  fetchDailyMovieFeed: (userId: string, signal?: AbortSignal) => Promise<DailyMovieFeed>;
}
const personal = createDailyFeedSlice('dailyMovies',
  (services: DailyMovieServices, userId, signal) => services.fetchDailyMovieFeed(userId, signal));
export const loadDailyMovies = personal.load;
export default personal.reducer;
