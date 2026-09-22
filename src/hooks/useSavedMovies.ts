import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchSavedMovies } from '../services/movieInteractions';
import type { SavedMovie } from '../types/movie';

interface SavedMoviesState {
  movies: SavedMovie[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useSavedMovies(pageSize = 20): SavedMoviesState {
  const [movies, setMovies] = useState<SavedMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offset = useRef(0);
  const generation = useRef(0);
  const loadingMore = useRef(false);
  const refreshing = useRef(false);

  useFocusEffect(useCallback(() => {
    const request = ++generation.current;
    refreshing.current = true;
    setHasError(false);
    void fetchSavedMovies(pageSize).then((page) => {
      if (request !== generation.current) return;
      offset.current = page.movies.length;
      setMovies(page.movies);
      setHasMore(page.hasMore);
    }).catch(() => {
      if (request === generation.current) setHasError(true);
      console.warn('Unable to load saved movies.');
    }).finally(() => {
      if (request === generation.current) {
        refreshing.current = false;
        setIsLoading(false);
      }
    });
    return () => { generation.current += 1; refreshing.current = false; };
  }, [pageSize]));

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMore.current || refreshing.current || isLoading || hasError || !hasMore) return;
    loadingMore.current = true;
    setIsLoadingMore(true);
    const request = generation.current;
    try {
      const page = await fetchSavedMovies(pageSize, offset.current);
      if (request !== generation.current) return;
      offset.current += page.movies.length;
      setMovies((current) => {
        const known = new Set(current.map((movie) => movie.id));
        return [...current, ...page.movies.filter((movie) => !known.has(movie.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      if (request === generation.current) setHasError(true);
      console.warn('Unable to load more saved movies.');
    } finally {
      loadingMore.current = false;
      if (request === generation.current) setIsLoadingMore(false);
    }
  }, [hasError, hasMore, isLoading, pageSize]);

  return { movies, isLoading, isLoadingMore, hasError, hasMore, loadMore };
}
