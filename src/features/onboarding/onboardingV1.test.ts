import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGE_KEYS, ALL_STEPS, APPROVED_MOVIE_IDS, CORE_STEPS, OPTIONAL_STEPS,
  canChooseDisliked, completionRevisionForRetry, completionSnapshot, deriveTasteProfile,
  hydrateDraft, nextStep, persistenceEnabled,
  presentationPercent, previousStep, resumeStep, skipOptionalSection, skipOptionalStep,
  toggleLimited, validCore, validStep, type OnboardingDraft,
} from './onboardingV1.ts';
import { resolveAppRoute } from '../../store/userDomainRouting.ts';

const genreA = '11111111-1111-4111-8111-111111111111';
const genreB = '22222222-2222-4222-8222-222222222222';
const requiredDraft: OnboardingDraft = {
  display_name: 'Serhat',
  avatar_choice: 'avatar_16',
  liked_genres: [genreA],
  movie_priorities: ['story', 'absurdity'],
  watch_intent: ['have_fun'],
  trash_tolerance: 4,
  discovery_preferences: { discovery_level: 5 },
};

test('V1 uses exact twelve stable steps and core validation', () => {
  assert.deepEqual(ALL_STEPS, [...CORE_STEPS, ...OPTIONAL_STEPS]);
  assert.equal(ALL_STEPS.length, 12);
  assert.equal(validCore(requiredDraft), true);
  for (const key of CORE_STEPS) {
    const missing = { ...requiredDraft };
    delete missing[key];
    assert.equal(validCore(missing), false, key);
  }
  assert.equal(validStep('display_name', { ...requiredDraft, display_name: '  ' }), false);
  assert.equal(validStep('display_name', { ...requiredDraft, display_name: 'a'.repeat(61) }), false);
  assert.equal(validStep('liked_genres', { ...requiredDraft, liked_genres: [] }), false);
  assert.equal(validStep('liked_genres', { ...requiredDraft, liked_genres: Array(6).fill(genreA) }), false);
  assert.equal(validStep('discovery_preferences', {
    ...requiredDraft, discovery_preferences: { discovery_level: 6 },
  }), false);
});

test('display name trims whitespace and enforces the ASCII 1–60 character boundary', () => {
  for (const display_name of [undefined, '', ' \t\n ']) {
    assert.equal(validStep('display_name', { display_name }), false);
  }
  for (const display_name of ['a', '  a  ', 'a'.repeat(60), `  ${'a'.repeat(60)}  `]) {
    assert.equal(validStep('display_name', { display_name }), true);
  }
  assert.equal(validStep('display_name', { display_name: 'a'.repeat(61) }), false);
});

test('display name counts Unicode code points instead of UTF-16 code units', () => {
  assert.equal(validStep('display_name', { display_name: '😀'.repeat(31) }), true);
  assert.equal(validStep('display_name', { display_name: `  ${'😀'.repeat(60)}  ` }), true);
  assert.equal(validStep('display_name', { display_name: '😀'.repeat(61) }), false);
  assert.equal(validStep('display_name', { display_name: `${'a'.repeat(59)}😀` }), true);
  assert.equal(validStep('display_name', { display_name: `${'a'.repeat(60)}😀` }), false);
});

test('priority and intent selection never exceeds three', () => {
  assert.deepEqual(toggleLimited(['story', 'characters', 'music'], 'ideas', 3), ['story', 'characters', 'music']);
  assert.deepEqual(toggleLimited(['have_fun', 'think', 'relax'], 'feel_tension', 3), ['have_fun', 'think', 'relax']);
  assert.equal(validStep('movie_priorities', {
    ...requiredDraft, movie_priorities: ['story', 'characters', 'music', 'ideas'],
  }), false);
  assert.equal(validStep('watch_intent', {
    ...requiredDraft, watch_intent: ['have_fun', 'think', 'relax', 'feel_tension'],
  }), false);
  assert.deepEqual(toggleLimited(['story', 'music'], 'story', 3), ['music']);
});

test('liked and disliked genres cannot overlap', () => {
  assert.equal(canChooseDisliked(requiredDraft, genreA), false);
  assert.equal(canChooseDisliked(requiredDraft, genreB), true);
  assert.equal(validStep('disliked_genres', { ...requiredDraft, disliked_genres: [genreA] }), false);
  assert.equal(validStep('disliked_genres', { ...requiredDraft, disliked_genres: [genreB] }), true);
});

test('optional section and individual skip remove optional answers', () => {
  const full: OnboardingDraft = {
    ...requiredDraft,
    disliked_genres: [genreB],
    movie_reactions: { [APPROVED_MOVIE_IDS[0]]: 1 },
    exploration_preferences: { classic_openness: 4 },
    movie_knowledge_self_rating: 8,
    demographics: { age_range: AGE_KEYS[1] },
  };
  assert.deepEqual(skipOptionalSection(full), requiredDraft);
  assert.equal(skipOptionalStep(full, 'movie_reactions').movie_reactions, undefined);
  assert.equal(skipOptionalStep(full, 'movie_reactions').disliked_genres?.[0], genreB);
  assert.equal(validCore(skipOptionalSection(full)), true);
});

test('hydration filters invalid input and resumes at saved stable step', () => {
  const raw = {
    ...requiredDraft, movie_priorities: ['story', 'unexpected'], liked_genres: [genreA, 42],
    movie_reactions: { [APPROVED_MOVIE_IDS[0]]: 1, 'not-a-curated-movie': -1 },
  };
  const restored = hydrateDraft(raw);
  assert.deepEqual(restored.movie_priorities, ['story']);
  assert.deepEqual(restored.liked_genres, [genreA]);
  assert.deepEqual(restored.movie_reactions, { [APPROVED_MOVIE_IDS[0]]: 1 });
  assert.equal(resumeStep('movie_reactions', restored), 'movie_reactions');
  assert.equal(resumeStep(null, requiredDraft), 'optional_intro');
  assert.equal(resumeStep('unknown', {}), 'display_name');
  assert.equal(resumeStep('demographics', { ...requiredDraft, liked_genres: [] }), 'liked_genres');
  assert.equal(nextStep('discovery_preferences'), 'optional_intro');
  assert.equal(nextStep('optional_intro'), 'disliked_genres');
  assert.equal(previousStep('disliked_genres'), 'optional_intro');
});

test('presentation scale and deterministic taste labels', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(presentationPercent), [0, 25, 50, 75, 100]);
  assert.equal(presentationPercent(undefined), null);
  assert.equal(deriveTasteProfile(requiredDraft).mode, 'chaos');
  assert.equal(deriveTasteProfile({
    ...requiredDraft, trash_tolerance: 2,
    discovery_preferences: { discovery_level: 4, popularity_preference: 4 },
  }).mode, 'explorer');
  assert.equal(deriveTasteProfile({
    ...requiredDraft, trash_tolerance: 2, exploration_preferences: { classic_openness: 5 },
  }).mode, 'classic');
  assert.equal(deriveTasteProfile({
    ...requiredDraft, trash_tolerance: 2,
    discovery_preferences: { discovery_level: 1, popularity_preference: 2 },
  }).mode, 'safe');
  assert.equal(deriveTasteProfile({ ...requiredDraft, trash_tolerance: 2 }).mode, 'balanced');
});

test('preview is always local; completion routing waits for domain refresh', () => {
  assert.equal(persistenceEnabled(true, 1), false);
  assert.equal(persistenceEnabled(true, null), false);
  assert.equal(persistenceEnabled(false, null), false);
  assert.equal(persistenceEnabled(false, 1), true);
  const auth = { isInitialized: true, userId: 'user-a' };
  const domain = { userId: 'user-a', status: 'ready' as const, requiredCompleted: false, activeRequestId: null };
  assert.equal(resolveAppRoute(auth, domain), 'onboarding');
  assert.equal(resolveAppRoute(auth, { ...domain, status: 'idle', requiredCompleted: null }), 'loading');
  assert.equal(resolveAppRoute(auth, { ...domain, requiredCompleted: true }), 'main');
});

test('a lost completion response retries completion without another progress save', () => {
  const pending = { revision: 8, snapshot: completionSnapshot(requiredDraft) };
  assert.equal(completionRevisionForRetry(pending, requiredDraft), 8);
  assert.equal(completionRevisionForRetry(pending, { ...requiredDraft, trash_tolerance: 2 }), null);
  assert.equal(completionRevisionForRetry(null, requiredDraft), null);
});
