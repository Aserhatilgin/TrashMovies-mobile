import type { AvatarKey } from '../../constants/Avatars';

export const CORE_STEPS = [
  'display_name', 'avatar_choice', 'liked_genres', 'movie_priorities',
  'watch_intent', 'trash_tolerance', 'discovery_preferences',
] as const;
export const OPTIONAL_STEPS = [
  'disliked_genres', 'movie_reactions', 'exploration_preferences',
  'movie_knowledge_self_rating', 'demographics',
] as const;
export const ALL_STEPS = [...CORE_STEPS, ...OPTIONAL_STEPS] as const;
export type StepId = typeof ALL_STEPS[number];
export type FlowStep = StepId | 'optional_intro';

export const PRIORITY_KEYS = [
  'story', 'characters', 'atmosphere', 'visuals', 'humor',
  'ideas', 'pace', 'music', 'originality', 'absurdity',
] as const;
export const INTENT_KEYS = [
  'have_fun', 'feel_tension', 'be_surprised', 'think', 'feel_emotion',
  'high_energy', 'relax', 'embrace_absurdity',
] as const;
export const RUNTIME_KEYS = ['60_90', '90_120', '120_150', '150_plus', 'no_preference'] as const;
export const AGE_KEYS = ['13_17', '18_24', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say'] as const;
export const GENDER_KEYS = ['woman', 'man', 'non_binary', 'another_identity', 'prefer_not_to_say'] as const;

export type PriorityKey = typeof PRIORITY_KEYS[number];
export type IntentKey = typeof INTENT_KEYS[number];
export type RuntimeKey = typeof RUNTIME_KEYS[number];
export type AgeKey = typeof AGE_KEYS[number];
export type GenderKey = typeof GENDER_KEYS[number];
export type Reaction = -1 | 1;

// Approved V1 order. The future publish migration must assert these UUIDs and positions.
export const APPROVED_MOVIE_IDS = [
  'e2e3b400-5219-4d69-a706-ff05653825c5',
  'd44bc6b1-292c-4a81-90fb-97988d98c637',
  'fd26ec0a-994b-4fc8-bc55-0fcbc04345cd',
  '627a80f2-3e6a-4538-ac89-c3b1f83007ba',
  'aa821107-d51b-4475-a599-bec9354ab268',
  '6b66e3f1-e3a6-4c39-8bfb-02ed6cb9089c',
  '82c25ab2-e421-47cf-984a-3172f143930d',
  '8b111814-f391-4497-bf01-4b3b55b3d22d',
  '3fead38d-8fa0-4c9e-b092-a9ca9df23890',
  '6c336121-7304-4785-99e3-28975c0bfa22',
  '5bebc825-41fe-426b-800b-ae29c9df40e9',
  'fb7002f0-477f-434a-bf10-3beb456e1cfd',
  '0cd23787-7568-4160-aabe-3db5b4f54d17',
  'ab81b28e-5e9c-49ac-9894-b3d7f59b7629',
  '685617d6-9ada-47a0-8871-03a6d6e6447e',
] as const;

export interface OnboardingDraft {
  display_name?: string;
  avatar_choice?: AvatarKey;
  liked_genres?: string[];
  movie_priorities?: PriorityKey[];
  watch_intent?: IntentKey[];
  trash_tolerance?: number;
  discovery_preferences?: { discovery_level?: number; popularity_preference?: number };
  disliked_genres?: string[];
  movie_reactions?: Record<string, Reaction>;
  exploration_preferences?: {
    classic_openness?: number;
    international_openness?: number;
    runtime_preference?: RuntimeKey;
  };
  movie_knowledge_self_rating?: number;
  demographics?: { age_range?: AgeKey; gender?: GenderKey };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isScale = (value: unknown, max = 5): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function toggleLimited<T extends string>(values: readonly T[] | undefined, value: T, max: number): T[] {
  const current = values ?? [];
  if (current.includes(value)) return current.filter((item) => item !== value);
  return current.length < max ? [...current, value] : [...current];
}

export function canChooseDisliked(draft: OnboardingDraft, genreId: string): boolean {
  return !(draft.liked_genres ?? []).some((id) => id.toLowerCase() === genreId.toLowerCase());
}

// Catalog UUIDs are authoritative. Preserve likes and drop overlapping dislikes.
// This corrects only the interactive draft; callers save on intentional actions.
export function reconcileDraftGenres(draft: OnboardingDraft, genres: readonly { id: string }[]): OnboardingDraft {
  const catalog = new Map(genres.map(({ id }) => [id.toLowerCase(), id]));
  const canonical = (values: readonly string[], max: number): string[] =>
    [...new Set(values.flatMap((id) => {
      const match = catalog.get(id.toLowerCase());
      return match ? [match] : [];
    }))].slice(0, max);
  const liked = canonical(draft.liked_genres ?? [], 5);
  const disliked = canonical(draft.disliked_genres ?? [], Infinity).filter((id) => !liked.includes(id)).slice(0, 3);
  return { ...draft,
    ...(draft.liked_genres !== undefined ? { liked_genres: liked } : {}),
    ...(draft.disliked_genres !== undefined ? { disliked_genres: disliked } : {}),
  };
}

export const MOVIES_PER_PAGE = 5;
export const MOVIE_PAGE_COUNT = APPROVED_MOVIE_IDS.length / MOVIES_PER_PAGE;
export function moviePageAction(page: number, action: 'next' | 'back'): number | null {
  if (action === 'next') return page < MOVIE_PAGE_COUNT - 1 ? page + 1 : null;
  return page > 0 ? page - 1 : null;
}

export function skipOptionalSection(draft: OnboardingDraft): OnboardingDraft {
  const { disliked_genres, movie_reactions, exploration_preferences,
    movie_knowledge_self_rating, demographics, ...core } = draft;
  return core;
}

export function skipOptionalStep(draft: OnboardingDraft, step: StepId): OnboardingDraft {
  const next = { ...draft };
  if (step === 'disliked_genres') delete next.disliked_genres;
  if (step === 'movie_reactions') delete next.movie_reactions;
  if (step === 'exploration_preferences') delete next.exploration_preferences;
  if (step === 'movie_knowledge_self_rating') delete next.movie_knowledge_self_rating;
  if (step === 'demographics') delete next.demographics;
  return next;
}

function validUnique<T>(value: readonly T[] | undefined, min: number, max: number): boolean {
  return !!value && value.length >= min && value.length <= max && new Set(value).size === value.length;
}

export function validStep(step: StepId, draft: OnboardingDraft): boolean {
  switch (step) {
    case 'display_name': {
      const name = draft.display_name?.trim() ?? '';
      const length = Array.from(name).length;
      return length >= 1 && length <= 60;
    }
    case 'avatar_choice': return !!draft.avatar_choice;
    case 'liked_genres': return validUnique(draft.liked_genres, 1, 5) && draft.liked_genres!.every(isUuid);
    case 'movie_priorities': return validUnique(draft.movie_priorities, 1, 3)
      && draft.movie_priorities!.every((key) => PRIORITY_KEYS.includes(key));
    case 'watch_intent': return validUnique(draft.watch_intent, 1, 3)
      && draft.watch_intent!.every((key) => INTENT_KEYS.includes(key));
    case 'trash_tolerance': return isScale(draft.trash_tolerance);
    case 'discovery_preferences': return isScale(draft.discovery_preferences?.discovery_level)
      && (draft.discovery_preferences?.popularity_preference === undefined
        || isScale(draft.discovery_preferences.popularity_preference));
    case 'disliked_genres': return (!draft.disliked_genres || validUnique(draft.disliked_genres, 0, 3))
      && (draft.disliked_genres ?? []).every((id) => isUuid(id) && canChooseDisliked(draft, id));
    case 'movie_reactions': return Object.entries(draft.movie_reactions ?? {}).every(
      ([id, reaction]) => APPROVED_MOVIE_IDS.includes(id as typeof APPROVED_MOVIE_IDS[number])
        && (reaction === -1 || reaction === 1),
    );
    case 'exploration_preferences': {
      const value = draft.exploration_preferences;
      return !value || ((value.classic_openness === undefined || isScale(value.classic_openness))
        && (value.international_openness === undefined || isScale(value.international_openness))
        && (value.runtime_preference === undefined || RUNTIME_KEYS.includes(value.runtime_preference)));
    }
    case 'movie_knowledge_self_rating': return draft.movie_knowledge_self_rating === undefined
      || isScale(draft.movie_knowledge_self_rating, 10);
    case 'demographics': return !draft.demographics
      || ((draft.demographics.age_range === undefined || AGE_KEYS.includes(draft.demographics.age_range))
        && (draft.demographics.gender === undefined || GENDER_KEYS.includes(draft.demographics.gender)));
  }
}

export function validCore(draft: OnboardingDraft): boolean {
  return CORE_STEPS.every((step) => validStep(step, draft));
}

export function nextStep(step: FlowStep): FlowStep | null {
  if (step === 'optional_intro') return OPTIONAL_STEPS[0];
  const index = ALL_STEPS.indexOf(step);
  if (index === CORE_STEPS.length - 1) return 'optional_intro';
  return ALL_STEPS[index + 1] ?? null;
}

export function previousStep(step: FlowStep): FlowStep | null {
  if (step === 'optional_intro') return CORE_STEPS[CORE_STEPS.length - 1];
  if (step === OPTIONAL_STEPS[0]) return 'optional_intro';
  return ALL_STEPS[ALL_STEPS.indexOf(step) - 1] ?? null;
}

export function resumeStep(currentStep: string | null, draft: OnboardingDraft): FlowStep {
  const missingCore = CORE_STEPS.find((step) => !validStep(step, draft));
  if (currentStep === 'optional_intro' || OPTIONAL_STEPS.includes(currentStep as typeof OPTIONAL_STEPS[number])) {
    return missingCore ?? currentStep as FlowStep;
  }
  if (CORE_STEPS.includes(currentStep as typeof CORE_STEPS[number])) {
    if (missingCore && CORE_STEPS.indexOf(missingCore) < CORE_STEPS.indexOf(currentStep as typeof CORE_STEPS[number])) {
      return missingCore;
    }
    return currentStep as StepId;
  }
  return missingCore ?? 'optional_intro';
}

export function hydrateDraft(raw: Record<string, unknown>): OnboardingDraft {
  const draft: OnboardingDraft = {};
  if (typeof raw.display_name === 'string') draft.display_name = raw.display_name;
  if (typeof raw.avatar_choice === 'string' && /^avatar_(0[1-9]|1[0-6])$/.test(raw.avatar_choice)) {
    draft.avatar_choice = raw.avatar_choice as AvatarKey;
  }
  if (Array.isArray(raw.liked_genres)) draft.liked_genres = raw.liked_genres.filter((item): item is string => typeof item === 'string');
  if (Array.isArray(raw.disliked_genres)) draft.disliked_genres = raw.disliked_genres.filter((item): item is string => typeof item === 'string');
  if (Array.isArray(raw.movie_priorities)) draft.movie_priorities = raw.movie_priorities.filter(
    (item): item is PriorityKey => PRIORITY_KEYS.includes(item as PriorityKey),
  );
  if (Array.isArray(raw.watch_intent)) draft.watch_intent = raw.watch_intent.filter(
    (item): item is IntentKey => INTENT_KEYS.includes(item as IntentKey),
  );
  if (isScale(raw.trash_tolerance)) draft.trash_tolerance = raw.trash_tolerance;
  if (isRecord(raw.discovery_preferences)) {
    const source = raw.discovery_preferences;
    draft.discovery_preferences = {
      ...(isScale(source.discovery_level) ? { discovery_level: source.discovery_level } : {}),
      ...(isScale(source.popularity_preference) ? { popularity_preference: source.popularity_preference } : {}),
    };
  }
  if (isRecord(raw.movie_reactions)) {
    draft.movie_reactions = Object.fromEntries(Object.entries(raw.movie_reactions).filter(
      ([id, value]) => APPROVED_MOVIE_IDS.includes(id as typeof APPROVED_MOVIE_IDS[number]) && (value === -1 || value === 1),
    )) as Record<string, Reaction>;
  }
  if (isRecord(raw.exploration_preferences)) {
    const source = raw.exploration_preferences;
    draft.exploration_preferences = {
      ...(isScale(source.classic_openness) ? { classic_openness: source.classic_openness } : {}),
      ...(isScale(source.international_openness) ? { international_openness: source.international_openness } : {}),
      ...(RUNTIME_KEYS.includes(source.runtime_preference as RuntimeKey)
        ? { runtime_preference: source.runtime_preference as RuntimeKey } : {}),
    };
  }
  if (isScale(raw.movie_knowledge_self_rating, 10)) draft.movie_knowledge_self_rating = raw.movie_knowledge_self_rating;
  if (isRecord(raw.demographics)) {
    const source = raw.demographics;
    draft.demographics = {
      ...(AGE_KEYS.includes(source.age_range as AgeKey) ? { age_range: source.age_range as AgeKey } : {}),
      ...(GENDER_KEYS.includes(source.gender as GenderKey) ? { gender: source.gender as GenderKey } : {}),
    };
  }
  return draft;
}

export function responseForSave(draft: OnboardingDraft): OnboardingDraft {
  return { ...draft, ...(draft.display_name !== undefined ? { display_name: draft.display_name.trim() } : {}) };
}

export interface PendingCompletion { revision: number; snapshot: string }
export function completionSnapshot(draft: OnboardingDraft): string {
  return JSON.stringify(responseForSave(draft));
}

export function completionRevisionForRetry(
  pending: PendingCompletion | null,
  draft: OnboardingDraft,
): number | null {
  return pending?.snapshot === completionSnapshot(draft) ? pending.revision : null;
}

export type TasteMode = 'chaos' | 'explorer' | 'classic' | 'safe' | 'balanced';
export function presentationPercent(value: number | undefined): number | null {
  return isScale(value) ? (value - 1) * 25 : null;
}

export function deriveTasteProfile(draft: OnboardingDraft): {
  mode: TasteMode;
  discovery: number | null;
  trash: number | null;
  classic: number | null;
  international: number | null;
} {
  const discovery = draft.discovery_preferences?.discovery_level;
  const popularity = draft.discovery_preferences?.popularity_preference;
  const classic = draft.exploration_preferences?.classic_openness;
  let mode: TasteMode = 'balanced';
  if ((draft.trash_tolerance ?? 0) >= 4 && draft.movie_priorities?.includes('absurdity')) mode = 'chaos';
  else if ((discovery ?? 0) >= 4 && (popularity ?? 0) >= 4) mode = 'explorer';
  else if ((classic ?? 0) >= 4) mode = 'classic';
  else if (discovery !== undefined && discovery <= 2 && popularity !== undefined && popularity <= 2) mode = 'safe';
  return {
    mode,
    discovery: presentationPercent(discovery),
    trash: presentationPercent(draft.trash_tolerance),
    classic: presentationPercent(classic),
    international: presentationPercent(draft.exploration_preferences?.international_openness),
  };
}

export function persistenceEnabled(preview: boolean, requiredVersion: number | null): boolean {
  return !preview && requiredVersion === 1;
}
