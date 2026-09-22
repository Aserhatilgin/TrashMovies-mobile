import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchDailyMoviesHistory } from '../services/movies';
import type { DailyMovie } from '../types/movie';

interface DailyMoviesState {
  dailyMovies: DailyMovie[];
  isLoading: boolean;
  hasError: boolean;
}

let cachedDailyMovies: DailyMovie[] | null = null;

function sameHistory(left: DailyMovie[], right: DailyMovie[]): boolean {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index];
    return item.scheduledDate === other.scheduledDate &&
      item.movie.id === other.movie.id &&
      item.movie.title === other.movie.title &&
      item.movie.description === other.movie.description &&
      item.movie.posterUrl === other.movie.posterUrl &&
      item.movie.tmdbRating === other.movie.tmdbRating;
  });
}

export function useDailyMovies(): DailyMoviesState {
  const [dailyMovies, setDailyMovies] = useState<DailyMovie[]>(cachedDailyMovies ?? []);
  const [isLoading, setIsLoading] = useState(cachedDailyMovies === null);
  const [hasError, setHasError] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (cachedDailyMovies === null) setIsLoading(true);
    setHasError(false);

    const loadMovie = async (): Promise<void> => {
      try {
        const history = await fetchDailyMoviesHistory();
        if (!active) return;

        cachedDailyMovies = history;
        setDailyMovies((current) => sameHistory(current, history) ? current : history);
      } catch {
        if (!active) return;

        setHasError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadMovie();

    return () => {
      active = false;
    };
  }, []));

  return { dailyMovies, isLoading, hasError };
}
