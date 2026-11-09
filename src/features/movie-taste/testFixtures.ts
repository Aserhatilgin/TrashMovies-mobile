import { APPROVED_MOVIE_IDS } from '../onboarding/onboardingV1.ts';
import type { MovieTasteSnapshot } from '../../types/movieTaste';

export const USER_A = '10000000-0000-4000-8000-000000000001';
export const USER_B = '10000000-0000-4000-8000-000000000002';
export const GENRE = '20000000-0000-4000-8000-000000000001';
export const OUTSIDE_MOVIE = '30000000-0000-4000-8000-000000000001';
export function snapshot(userId = USER_A, revision = 0): MovieTasteSnapshot {
  return { userId, revision, editableMovieIds: [...APPROVED_MOVIE_IDS],
    genres: [{ id: GENRE, name: 'Comedy' }],
    movies: [...APPROVED_MOVIE_IDS, OUTSIDE_MOVIE].map((id) => ({ id, title: id, posterUrl: null, releaseDate: null })),
    preferences: { liked_genres: [GENRE], disliked_genres: [], movie_priorities: ['story'], watch_intents: ['have_fun'],
      trash_tolerance: 3, discovery_level: 4, popularity_preference: null,
      classic_openness: null, international_openness: null, runtime_preference: null,
      movie_reactions: { [APPROVED_MOVIE_IDS[0]]: 1, [OUTSIDE_MOVIE]: -1 }, movie_knowledge_self_rating: null } };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
