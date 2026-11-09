import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { store, type AppDispatch, type RootState } from '../store';
import { clearTasteSaveError, loadMovieTaste, persistMovieTaste } from '../store/movieTasteSlice';
import type { MovieTasteValues } from '../types/movieTaste';

export function useMovieTaste(userId: string, sessionGeneration: number) {
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((s: RootState) => s.movieTaste);
  const generation = useRef(0);
  const active = useRef(true);
  const pending = useRef(new Set<{ abort: () => void }>());
  const isCurrent = useCallback((requestGeneration: number) => {
    const auth = store.getState().auth;
    return active.current && generation.current === requestGeneration && auth.user?.id === userId && auth.sessionGeneration === sessionGeneration;
  }, [userId, sessionGeneration]);
  useEffect(() => {
    active.current = true;
    const invalidate = () => {
      active.current = false;
      generation.current += 1;
      pending.current.forEach((request) => request.abort());
      pending.current.clear();
    };
    const unsubscribe = store.subscribe(() => {
      const auth = store.getState().auth;
      if (auth.user?.id !== userId || auth.sessionGeneration !== sessionGeneration) invalidate();
    });
    return () => { unsubscribe(); invalidate(); };
  }, [userId, sessionGeneration]);
  const startLoad = useCallback(() => dispatch(loadMovieTaste({ userId, sessionGeneration })), [dispatch, userId, sessionGeneration]);
  useFocusEffect(useCallback(() => {
    const request = startLoad();
    pending.current.add(request);
    void request.finally(() => pending.current.delete(request));
    return () => { request.abort(); pending.current.delete(request); };
  }, [startLoad]));
  const reload = useCallback(async () => {
    const captured = generation.current;
    if (!isCurrent(captured)) return null;
    const request = startLoad(); pending.current.add(request);
    try {
      await request.unwrap();
      return isCurrent(captured) ? store.getState().movieTaste.snapshot : null;
    } catch { return null; } finally { pending.current.delete(request); }
  }, [isCurrent, startLoad]);
  const save = useCallback(async (revision: number, preferences: MovieTasteValues) => {
    const captured = generation.current;
    if (!isCurrent(captured)) return false;
    const request = dispatch(persistMovieTaste({ userId, sessionGeneration, revision, preferences }));
    pending.current.add(request);
    try {
      await request.unwrap();
      return isCurrent(captured);
    } catch { return false; } finally { pending.current.delete(request); }
  }, [dispatch, userId, sessionGeneration, isCurrent]);
  const clearSaveError = useCallback(() => dispatch(clearTasteSaveError({ userId, sessionGeneration })), [dispatch, userId, sessionGeneration]);
  return { ...state, reload, save, clearSaveError, loading: state.loadRequestId !== null, saving: state.saveRequestId !== null };
}
