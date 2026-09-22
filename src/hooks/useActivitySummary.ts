import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import type { ActivitySummary } from '../services/activity';
import type { RootState } from '../store';

interface ActivitySummaryState {
  summary: ActivitySummary | null;
  isLoading: boolean;
  hasError: boolean;
}

export function useActivitySummary(): ActivitySummaryState {
  const activity = useSelector((state: RootState) => state.activity);
  const summary = useMemo<ActivitySummary | null>(() => {
    if (activity.currentStreak === null || activity.totalActiveDays === null || activity.lastSevenDays === null) {
      return null;
    }
    return {
      currentStreak: activity.currentStreak,
      totalActiveDays: activity.totalActiveDays,
      lastSevenDays: activity.lastSevenDays,
    };
  }, [activity.currentStreak, activity.totalActiveDays, activity.lastSevenDays]);

  return { summary, isLoading: !activity.isInitialized, hasError: activity.error !== null };
}
