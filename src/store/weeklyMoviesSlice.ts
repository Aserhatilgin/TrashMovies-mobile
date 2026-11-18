import { createDailyFeedSlice } from '../features/daily-movies/createDailyFeedSlice.ts';
import type { WeeklyMovieCollection } from '../types/weeklyMovies';

export interface WeeklyMovieServices {
  fetchWeeklyMovieCollection: (userId: string, signal?: AbortSignal) => Promise<WeeklyMovieCollection>;
}
const weekly = createDailyFeedSlice('weeklyMovies',
  (services: WeeklyMovieServices, userId, signal) => services.fetchWeeklyMovieCollection(userId, signal));
export const loadWeeklyMovies = weekly.load;
export default weekly.reducer;
