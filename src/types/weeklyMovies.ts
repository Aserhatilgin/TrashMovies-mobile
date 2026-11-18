import type { Movie } from './movie';

export interface WeeklyMovie { position: number; movie: Movie }
export interface WeeklyMovieCollection {
  userId: string;
  weekStart: string;
  weekEnd: string;
  selectedOn: string;
  preferencesRevision: number;
  algorithmVersion: 1;
  status: 'ready' | 'empty';
  items: WeeklyMovie[];
}
