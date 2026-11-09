import { APPROVED_MOVIE_IDS, INTENT_KEYS, PRIORITY_KEYS, RUNTIME_KEYS, validStep } from '../onboarding/onboardingV1.ts';
import type { StepId, Reaction } from '../onboarding/onboardingV1.ts';
import type { MovieTasteDraft, MovieTasteSnapshot, MovieTasteValues } from '../../types/movieTaste';

const TASTE_STEPS: StepId[] = ['liked_genres', 'disliked_genres', 'movie_priorities', 'watch_intent',
  'trash_tolerance', 'discovery_preferences', 'exploration_preferences', 'movie_reactions', 'movie_knowledge_self_rating'];

export function validMovieTaste(draft: MovieTasteDraft): boolean {
  return TASTE_STEPS.every((step) => validStep(step, draft));
}

export function tasteDraft(snapshot: MovieTasteSnapshot): MovieTasteDraft {
  const p = snapshot.preferences;
  return {
    liked_genres: [...p.liked_genres], disliked_genres: [...p.disliked_genres],
    movie_priorities: p.movie_priorities === null ? undefined : [...p.movie_priorities],
    watch_intent: p.watch_intents === null ? undefined : [...p.watch_intents],
    trash_tolerance: p.trash_tolerance ?? undefined,
    discovery_preferences: { discovery_level: p.discovery_level ?? undefined, popularity_preference: p.popularity_preference ?? undefined },
    exploration_preferences: { classic_openness: p.classic_openness ?? undefined,
      international_openness: p.international_openness ?? undefined, runtime_preference: p.runtime_preference ?? undefined },
    movie_reactions: Object.fromEntries(Object.entries(p.movie_reactions).filter(([id]) => snapshot.editableMovieIds.includes(id))),
    movie_knowledge_self_rating: p.movie_knowledge_self_rating ?? undefined,
  };
}

// Canonical sets make dirty checks, no-op saves and lost-response recovery agree.
export function tastePayload(draft: MovieTasteDraft): MovieTasteValues {
  return {
    liked_genres: [...(draft.liked_genres ?? [])].sort(),
    disliked_genres: [...(draft.disliked_genres ?? [])].sort(),
    movie_priorities: draft.movie_priorities === undefined ? null : [...draft.movie_priorities].sort(),
    watch_intents: draft.watch_intent === undefined ? null : [...draft.watch_intent].sort(),
    trash_tolerance: draft.trash_tolerance ?? null,
    discovery_level: draft.discovery_preferences?.discovery_level ?? null,
    popularity_preference: draft.discovery_preferences?.popularity_preference ?? null,
    classic_openness: draft.exploration_preferences?.classic_openness ?? null,
    international_openness: draft.exploration_preferences?.international_openness ?? null,
    runtime_preference: draft.exploration_preferences?.runtime_preference ?? null,
    movie_reactions: Object.fromEntries(Object.entries(draft.movie_reactions ?? {}).sort(([a], [b]) => a.localeCompare(b))),
    movie_knowledge_self_rating: draft.movie_knowledge_self_rating ?? null,
  };
}

export function sameTaste(left: MovieTasteValues, right: MovieTasteValues): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')
    || new Set(value).size !== value.length) throw new Error('Invalid taste array.');
  return value;
}
function scale(value: unknown, max = 5): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > max) throw new Error('Invalid taste scale.');
  return value as number;
}
function choices<T extends string>(value: unknown, allowed: readonly T[]): T[] | null {
  if (value === null) return null;
  const items = strings(value);
  if (items.length > 3 || !items.every((item): item is T => allowed.includes(item as T))) throw new Error('Invalid taste choices.');
  return items;
}

export function parseMovieTaste(raw: unknown, posterUrl: (path: string) => string): MovieTasteSnapshot {
  if (!object(raw) || !uuid(raw.user_id) || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0
    || !object(raw.preferences) || !Array.isArray(raw.genres) || !Array.isArray(raw.movies)) throw new Error('Invalid taste response.');
  const p = raw.preferences;
  const liked = strings(p.liked_genres), disliked = strings(p.disliked_genres);
  if (![...liked, ...disliked].every(uuid) || liked.some((id) => disliked.includes(id))) throw new Error('Invalid taste genres.');
  if (!object(p.movie_reactions) || !Object.entries(p.movie_reactions).every(([id, v]) => uuid(id) && (v === -1 || v === 1))) {
    throw new Error('Invalid taste reactions.');
  }
  const editable = strings(raw.editable_movie_ids);
  if (editable.length !== APPROVED_MOVIE_IDS.length || editable.some((id, i) => id !== APPROVED_MOVIE_IDS[i])) {
    throw new Error('Published V1 movie set is unavailable.');
  }
  if (p.runtime_preference !== null && !RUNTIME_KEYS.includes(p.runtime_preference as typeof RUNTIME_KEYS[number])) {
    throw new Error('Invalid taste runtime.');
  }
  const genres = raw.genres.map((g) => {
    if (!object(g) || !uuid(g.id) || typeof g.name !== 'string') throw new Error('Invalid taste genre metadata.');
    return { id: g.id, name: g.name };
  });
  const movies = raw.movies.map((m) => {
    if (!object(m) || !uuid(m.id) || typeof m.title !== 'string'
      || !(m.poster_path === null || typeof m.poster_path === 'string')
      || !(m.release_date === null || typeof m.release_date === 'string')) throw new Error('Invalid taste movie metadata.');
    return { id: m.id, title: m.title, posterUrl: m.poster_path ? posterUrl(m.poster_path) : null,
      releaseDate: m.release_date };
  });
  if (new Set(genres.map((g) => g.id)).size !== genres.length || new Set(movies.map((m) => m.id)).size !== movies.length
    || editable.some((id) => !movies.some((m) => m.id === id))) throw new Error('Incomplete taste metadata.');
  return { userId: raw.user_id, revision: raw.revision as number, genres, movies, editableMovieIds: editable,
    preferences: { liked_genres: liked, disliked_genres: disliked,
      movie_priorities: choices(p.movie_priorities, PRIORITY_KEYS), watch_intents: choices(p.watch_intents, INTENT_KEYS),
      trash_tolerance: scale(p.trash_tolerance), discovery_level: scale(p.discovery_level),
      popularity_preference: scale(p.popularity_preference), classic_openness: scale(p.classic_openness),
      international_openness: scale(p.international_openness), runtime_preference: p.runtime_preference as MovieTasteValues['runtime_preference'],
      movie_reactions: p.movie_reactions as Record<string, Reaction>, movie_knowledge_self_rating: scale(p.movie_knowledge_self_rating, 10) } };
}
