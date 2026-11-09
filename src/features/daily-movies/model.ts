import type { DailyMovie, DailyMovieFeed } from '../../types/movie';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function date(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function parseDailyMovieFeed(raw: unknown, userId: string, posterUrl: (path: string) => string): DailyMovieFeed {
  if (!object(raw) || raw.user_id !== userId || !date(raw.today)
    || typeof raw.status !== 'string' || !['assigned', 'no_candidate', 'no_shared_movie'].includes(raw.status)
    || !Array.isArray(raw.items) || raw.items.length > 30) throw new Error('Invalid daily movie feed.');
  const today = raw.today;
  const items: DailyMovie[] = raw.items.map((item: unknown) => {
    if (!object(item) || !date(item.scheduled_date) || item.scheduled_date > today
      || (item.source !== 'personal' && item.source !== 'shared') || !object(item.movie)) {
      throw new Error('Invalid daily movie item.');
    }
    const movie = item.movie;
    if (typeof movie.id !== 'string' || !movie.id || typeof movie.title !== 'string' || !movie.title
      || typeof movie.overview !== 'string' || !movie.overview || typeof movie.poster_path !== 'string' || !movie.poster_path
      || !(movie.tmdb_rating === null || (typeof movie.tmdb_rating === 'number'
        && Number.isFinite(movie.tmdb_rating) && movie.tmdb_rating >= 0 && movie.tmdb_rating <= 10))) {
      throw new Error('Invalid daily movie metadata.');
    }
    return { scheduledDate: item.scheduled_date, source: item.source, movie: {
      id: movie.id, title: movie.title, description: movie.overview,
      posterUrl: posterUrl(movie.poster_path), tmdbRating: movie.tmdb_rating,
    } };
  });
  if (items.some((item, index) => index > 0 && item.scheduledDate <= items[index - 1].scheduledDate)
    || (raw.status === 'assigned') !== items.some((item) => item.scheduledDate === today)) {
    throw new Error('Inconsistent daily movie history.');
  }
  return { userId, today, status: raw.status as DailyMovieFeed['status'], items };
}
