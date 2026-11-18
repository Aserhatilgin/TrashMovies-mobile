import type { WeeklyMovieCollection } from '../../types/weeklyMovies';
import { parseMovie } from '../daily-movies/model.ts';
import { weekForDate } from '../../utils/istanbulWeek.ts';

const object = (raw: unknown): raw is Record<string, unknown> => typeof raw === 'object' && raw !== null && !Array.isArray(raw);
const date = (raw: unknown): raw is string => typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)
  && Number.isFinite(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw;

export function parseWeeklyMovieCollection(raw: unknown, userId: string, posterUrl: (path: string) => string): WeeklyMovieCollection {
  if (!object(raw) || raw.user_id !== userId || !date(raw.week_start) || !date(raw.week_end) || !date(raw.selected_on)
    || weekForDate(raw.week_start).start !== raw.week_start || weekForDate(raw.week_start).end !== raw.week_end
    || raw.selected_on < raw.week_start || raw.selected_on > raw.week_end
    || !Number.isSafeInteger(raw.preferences_revision) || (raw.preferences_revision as number) < 0 || raw.algorithm_version !== 1
    || !Array.isArray(raw.items) || raw.items.length > 5
    || raw.status !== (raw.items.length === 0 ? 'empty' : 'ready')) throw new Error('Invalid weekly collection.');
  const ids = new Set<string>();
  const items = raw.items.map((item: unknown, index) => {
    if (!object(item) || item.position !== index + 1) throw new Error('Invalid weekly position.');
    const parsed = parseMovie(item.movie, posterUrl);
    if (ids.has(parsed.id)) throw new Error('Duplicate weekly movie.');
    ids.add(parsed.id);
    return { position: index + 1, movie: parsed };
  });
  return { userId, weekStart: raw.week_start, weekEnd: raw.week_end, selectedOn: raw.selected_on,
    preferencesRevision: raw.preferences_revision as number, algorithmVersion: 1, status: raw.status as 'ready' | 'empty', items };
}
