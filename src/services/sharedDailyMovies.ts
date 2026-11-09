import type { DailyMovieFeed } from '../types/movie';
import { fetchDailyMoviesHistory, istanbulDate } from './movies';

// Home always reads the shared calendar, regardless of the personal V1 flag.
export async function fetchSharedDailyMovieFeed(userId: string, signal?: AbortSignal): Promise<DailyMovieFeed> {
  return { userId, today: istanbulDate(new Date()), status: 'legacy', items: await fetchDailyMoviesHistory(signal) };
}
