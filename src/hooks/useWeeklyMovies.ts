import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { store, type AppDispatch, type RootState } from '../store';
import { loadWeeklyMovies } from '../store/weeklyMoviesSlice';
import { startDailyMovieRefresh } from '../features/daily-movies/focusRefresh';
import { currentWeeklyCollection, shouldLoadWeeklyCollection } from '../features/weekly-movies/presentation';
import { istanbulWeek, weekForDate } from '../utils/istanbulWeek';

export function useWeeklyMovies() {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((s: RootState) => s.auth);
  const state = useSelector((s: RootState) => s.weeklyMovies);
  const userId = auth.user?.id ?? null, generation = auth.sessionGeneration;
  const [week, setWeek] = useState(() => istanbulWeek(new Date()).start);
  const load = useCallback(() => {
    setWeek(istanbulWeek(new Date()).start);
    return userId ? dispatch(loadWeeklyMovies({ userId, sessionGeneration: generation })) : null;
  }, [dispatch, userId, generation]);
  const focusLoad = useCallback(() => {
    const cached = store.getState().weeklyMovies;
    if (!shouldLoadWeeklyCollection(cached, userId, generation, istanbulWeek(new Date()).start)) return null;
    return load();
  }, [load, userId, generation]);
  useFocusEffect(useCallback(() => startDailyMovieRefresh({
    load: focusLoad, onDateChange: (date) => setWeek(weekForDate(date).start),
    subscribeActive: (active) => {
      const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') active(); });
      return () => subscription.remove();
    },
  }), [focusLoad]));
  const owned = state.userId === userId && state.sessionGeneration === generation;
  const collection = currentWeeklyCollection(owned ? state.feed : null, week);
  return { collection, hasError: owned && state.hasError,
    isLoading: owned && (state.requestId !== null || (!state.feed && !state.hasError)), reload: load };
}
