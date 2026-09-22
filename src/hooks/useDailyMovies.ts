import { useEffect, useState } from 'react';

import { fetchDailyMoviesHistory } from '../services/movies';
import type { DailyMovie } from '../types/movie';

interface DailyMoviesState {
  dailyMovies: DailyMovie[];
  isLoading: boolean;
  hasError: boolean;
}

export function useDailyMovies(): DailyMoviesState {
  const [dailyMovies, setDailyMovies] = useState<DailyMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadMovie = async (): Promise<void> => {
      try {
        const history = await fetchDailyMoviesHistory();
        if (!isMounted) return;

        setDailyMovies(history);
      } catch {
        if (!isMounted) return;

        setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadMovie();

    return () => {
      isMounted = false;
    };
  }, []);

  return { dailyMovies, isLoading, hasError };
}
