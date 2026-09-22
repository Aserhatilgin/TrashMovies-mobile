export interface Movie {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  tmdbRating: number | null;
}

export interface DailyMovie {
  scheduledDate: string;
  movie: Movie;
}
