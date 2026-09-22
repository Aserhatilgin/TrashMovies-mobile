import { supabase } from '../lib/supabase';

export interface ActivityDay {
  date: string;
  weekday: number;
  hasActivity: boolean;
}

export interface ActivitySummary {
  currentStreak: number;
  totalActiveDays: number;
  lastSevenDays: ActivityDay[];
}

function istanbulToday(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export async function recordDailyActivity(): Promise<void> {
  const { error } = await supabase.rpc('record_daily_activity');

  if (error) {
    throw new Error('Unable to record daily activity.');
  }
}

export async function fetchActivitySummary(userId: string): Promise<ActivitySummary> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== userId) throw new Error('Authentication required.');

  const today = istanbulToday(new Date());
  const recentDates = new Set<string>();
  let expected = today;
  let currentStreak = 0;
  let totalActiveDays = 0;

  // Continue only while rows are consecutive; this also supports streaks over 100 days.
  for (let offset = 0; ; offset += 100) {
    const { data, error, count } = await supabase.from('user_daily_activity')
      .select('activity_date', offset === 0 ? { count: 'exact' } : undefined)
      .eq('user_id', userId)
      .lte('activity_date', today)
      .order('activity_date', { ascending: false })
      .range(offset, offset + 99);
    if (error || !data) throw new Error('Unable to load daily activity.');
    if (offset === 0) totalActiveDays = count ?? 0;

    if (offset === 0) {
      for (const row of data) {
        if (row.activity_date >= addDays(today, -6)) recentDates.add(row.activity_date);
      }
    }
    let hasGap = false;
    for (const row of data) {
      if (row.activity_date !== expected) { hasGap = true; break; }
      currentStreak += 1;
      expected = addDays(expected, -1);
    }
    if (hasGap || data.length < 100) break;
  }

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    return { date, weekday, hasActivity: recentDates.has(date) };
  });
  return { currentStreak, totalActiveDays, lastSevenDays };
}
