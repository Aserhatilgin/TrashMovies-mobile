import type { WeeklyMovieCollection } from '../../types/weeklyMovies';

export function currentWeeklyCollection(feed: WeeklyMovieCollection | null, currentWeek: string): WeeklyMovieCollection | null {
  return feed?.weekStart === currentWeek ? feed : null;
}

// The same decision is used by focus, foreground and midnight refreshes.
export function shouldLoadWeeklyCollection(state: { userId: string | null; sessionGeneration: number | null; hasError: boolean; feed: WeeklyMovieCollection | null }, userId: string | null, generation: number, week: string): boolean {
  return state.userId !== userId || state.sessionGeneration !== generation || state.hasError || state.feed?.weekStart !== week;
}
