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
  source?: 'personal' | 'shared';
}

export type DailyMovieFeedStatus = 'assigned' | 'no_candidate' | 'no_shared_movie' | 'legacy';
export interface DailyMovieFeed {
  userId: string;
  today: string;
  status: DailyMovieFeedStatus;
  items: DailyMovie[];
}

export interface SavedMovie {
  id: string;
  title: string;
  posterUrl: string;
  savedAt: string;
}
