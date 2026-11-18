import { istanbulDate } from './istanbulDate.ts';

// Client calculation only invalidates stale UI. The server chooses/persists the
// actual week and returns its dates; the RPC accepts no client clock parameter.
export function weekForDate(day: string): { start: string; end: string } {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: date.toISOString().slice(0, 10) };
}
export function istanbulWeek(date: Date): { start: string; end: string } {
  return weekForDate(istanbulDate(date));
}
