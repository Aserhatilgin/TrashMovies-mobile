import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchMovieInteractions,
  setMovieRating,
  setMovieSaved,
  setMovieWatched,
} from '../services/movieInteractions';
import type { MovieInteraction } from '../types/movieInteraction';

interface MovieInteractionsState {
  interactionsByMovieId: Record<string, MovieInteraction>;
  isLoading: boolean;
  pendingMovieIds: string[];
  hasError: boolean;
  toggleSaved: (movieId: string) => Promise<void>;
  toggleWatched: (movieId: string) => Promise<void>;
  saveRating: (movieId: string, rating: number) => Promise<boolean>;
}

export function useMovieInteractions(movieIds: string[]): MovieInteractionsState {
  const [interactionsByMovieId, setInteractions] = useState<Record<string, MovieInteraction>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pendingMovieIds, setPendingMovieIds] = useState<string[]>([]);
  const pending = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setHasError(false);
    void fetchMovieInteractions(movieIds).then((interactions) => {
      if (active) setInteractions(interactions);
    }).catch(() => {
      if (active) setHasError(true);
      console.warn('Unable to load movie interactions.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [movieIds]);

  const mutate = useCallback(async (
    movieId: string,
    operation: () => Promise<MovieInteraction | null>,
  ): Promise<boolean> => {
    if (pending.current.has(movieId) || isLoading || hasError) return false;
    pending.current.add(movieId);
    setPendingMovieIds([...pending.current]);
    try {
      const interaction = await operation();
      setInteractions((current) => {
        const next = { ...current };
        if (interaction) next[movieId] = interaction;
        else delete next[movieId];
        return next;
      });
      return true;
    } catch {
      console.warn('Unable to update movie interaction.');
      return false;
    } finally {
      pending.current.delete(movieId);
      setPendingMovieIds([...pending.current]);
    }
  }, [hasError, isLoading]);

  const toggleSaved = useCallback(async (movieId: string): Promise<void> => {
    const saved = interactionsByMovieId[movieId]?.savedAt !== null && interactionsByMovieId[movieId]?.savedAt !== undefined;
    await mutate(movieId, () => setMovieSaved(movieId, !saved));
  }, [interactionsByMovieId, mutate]);

  const toggleWatched = useCallback(async (movieId: string): Promise<void> => {
    const watched = interactionsByMovieId[movieId]?.watchedAt !== null && interactionsByMovieId[movieId]?.watchedAt !== undefined;
    await mutate(movieId, () => setMovieWatched(movieId, !watched));
  }, [interactionsByMovieId, mutate]);

  const saveRating = useCallback((movieId: string, rating: number): Promise<boolean> =>
    mutate(movieId, () => setMovieRating(movieId, rating)), [mutate]);

  return { interactionsByMovieId, isLoading, pendingMovieIds, hasError, toggleSaved, toggleWatched, saveRating };
}
