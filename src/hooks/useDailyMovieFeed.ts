import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { istanbulDate } from '../utils/istanbulDate';
import { dailyMoviePresentation } from '../features/daily-movies/presentation';
import { startDailyMovieRefresh } from '../features/daily-movies/focusRefresh';
import { loadDailyMovies } from '../store/dailyMoviesSlice';
import { loadSharedDailyMovies } from '../store/sharedDailyMoviesSlice';
import type { AppDispatch, RootState } from '../store';

export function useDailyMovieFeed(kind: 'shared' | 'personal') {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);
  const state = useSelector((state: RootState) => kind === 'personal' ? state.dailyMovies : state.sharedDailyMovies);
  const userId = auth.user?.id ?? null;
  const generation = auth.sessionGeneration;
  const [today, setToday] = useState(() => istanbulDate(new Date()));
  const load = useCallback(() => {
    setToday(istanbulDate(new Date()));
    if (!userId) return null;
    const session = { userId, sessionGeneration: generation };
    return kind === 'personal' ? dispatch(loadDailyMovies(session)) : dispatch(loadSharedDailyMovies(session));
  }, [dispatch, userId, generation, kind]);

  useFocusEffect(useCallback(() => startDailyMovieRefresh({
    load,
    onDateChange: setToday,
    subscribeActive: (onActive) => {
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active') onActive();
      });
      return () => subscription.remove();
    },
  }), [load]));

  const owned = state.userId === userId && state.sessionGeneration === generation;
  const feed = owned ? state.feed : null;
  return {
    ...dailyMoviePresentation(feed, today),
    isLoading: owned && (state.requestId !== null || (!feed && !state.hasError)),
    hasError: owned && state.hasError, reload: load,
  };
}
