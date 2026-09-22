import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch } from 'react-redux';

import { recordDailyActivity } from '../services/activity';
import type { AppDispatch } from '../store';
import { refreshActivitySummary } from '../store/activitySlice';

export function useDailyActivityRecorder(userId: string | null): void {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (!userId) return;

    let active = true;
    let inFlight = false;
    let previousState = AppState.currentState;
    const record = (): void => {
      if (inFlight) return;
      inFlight = true;
      void (async () => {
        try {
          await recordDailyActivity();
        } catch {
          console.warn('Unable to record daily activity.');
        } finally {
          if (active) await dispatch(refreshActivitySummary(userId));
          inFlight = false;
        }
      })();
    };

    if (previousState === 'active' || previousState == null) {
      record();
      previousState = 'active';
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && previousState !== 'active') record();
      previousState = nextState;
    });

    return () => { active = false; subscription.remove(); };
  }, [dispatch, userId]);
}
