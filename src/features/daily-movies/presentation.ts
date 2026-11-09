import type { DailyMovieFeed } from '../../types/movie';

// History survives transport failures. Only a response for the current Istanbul
// day can supply today's card or today's empty-state reason.
export function dailyMoviePresentation(feed: DailyMovieFeed | null, today: string) {
  const current = feed?.today === today;
  return {
    dailyMovies: feed?.items ?? [],
    today,
    todayMovies: current ? feed.items.filter((item) => item.scheduledDate === today) : [],
    todayStatus: current ? feed.status : undefined,
  };
}
