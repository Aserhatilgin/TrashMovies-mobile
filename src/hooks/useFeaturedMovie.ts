import { useEffect, useState } from 'react';

import { fetchFeaturedMovie } from '../services/movies';
import type { Movie } from '../types/movie';

interface FeaturedMovieState {
  movie: Movie | null;
  isLoading: boolean;
  hasError: boolean;
}

export function useFeaturedMovie(): FeaturedMovieState {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadMovie = async (): Promise<void> => {
      try {
        const featuredMovie = await fetchFeaturedMovie();
        if (!isMounted) return;

        setMovie(featuredMovie);
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

  return { movie, isLoading, hasError };
}
