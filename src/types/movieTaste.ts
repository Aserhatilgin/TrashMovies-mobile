import type { OnboardingGenre, OnboardingMovie } from '../services/onboarding';
import type { IntentKey, OnboardingDraft, PriorityKey, Reaction, RuntimeKey } from '../features/onboarding/onboardingV1';

export interface MovieTasteValues {
  liked_genres: string[];
  disliked_genres: string[];
  movie_priorities: PriorityKey[] | null;
  watch_intents: IntentKey[] | null;
  trash_tolerance: number | null;
  discovery_level: number | null;
  popularity_preference: number | null;
  classic_openness: number | null;
  international_openness: number | null;
  runtime_preference: RuntimeKey | null;
  movie_reactions: Record<string, Reaction>;
  movie_knowledge_self_rating: number | null;
}

export interface MovieTasteSnapshot {
  userId: string;
  revision: number;
  preferences: MovieTasteValues;
  genres: OnboardingGenre[];
  movies: OnboardingMovie[];
  editableMovieIds: string[];
}

export type MovieTasteDraft = Pick<OnboardingDraft,
  'liked_genres' | 'disliked_genres' | 'movie_priorities' | 'watch_intent' |
  'trash_tolerance' | 'discovery_preferences' | 'exploration_preferences' |
  'movie_reactions' | 'movie_knowledge_self_rating'>;
