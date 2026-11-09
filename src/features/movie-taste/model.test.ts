import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMovieTaste, sameTaste, tasteDraft, tastePayload, validMovieTaste } from './model.ts';
import { snapshot, GENRE, OUTSIDE_MOVIE } from './testFixtures.ts';
import { APPROVED_MOVIE_IDS } from '../onboarding/onboardingV1.ts';

test('normalized values round trip, with outside reactions read but never submitted for replacement', () => {
  const current = snapshot();
  const draft = tasteDraft(current);
  assert.equal(validMovieTaste(draft), true);
  assert.deepEqual(tastePayload(draft), { ...current.preferences, movie_reactions: { [APPROVED_MOVIE_IDS[0]]: 1 } });
  assert.equal(current.preferences.movie_reactions[OUTSIDE_MOVIE], -1);
  draft.liked_genres!.pop();
  assert.deepEqual(current.preferences.liked_genres, [GENRE]);
});

test('required fields cannot be cleared; optional values and reactions can', () => {
  const current = snapshot();
  Object.assign(current.preferences, { popularity_preference: 5, classic_openness: 4,
    international_openness: 2, runtime_preference: 'no_preference', movie_knowledge_self_rating: 7 });
  const draft = tasteDraft(current);
  for (const patch of [{ liked_genres: [] }, { movie_priorities: [] }, { watch_intent: [] },
    { trash_tolerance: undefined }, { discovery_preferences: {} }]) {
    assert.equal(validMovieTaste({ ...draft, ...patch }), false);
  }
  const cleared = { ...draft, disliked_genres: [], movie_reactions: {}, exploration_preferences: {},
    movie_knowledge_self_rating: undefined, discovery_preferences: { discovery_level: 3 } };
  assert.equal(validMovieTaste(cleared), true);
  const values = tastePayload(cleared);
  assert.equal(values.popularity_preference, null);
  assert.equal(values.runtime_preference, null);
  assert.equal(values.classic_openness, null);
  assert.equal(values.international_openness, null);
  assert.equal(values.movie_knowledge_self_rating, null);
  assert.deepEqual(values.movie_reactions, {});
});

test('NULL, empty arrays and explicit no_preference remain distinct without onboarding fallback', () => {
  const current = snapshot(); current.preferences.movie_priorities = null;
  const missing = tastePayload(tasteDraft(current));
  assert.equal(missing.movie_priorities, null);
  current.preferences.movie_priorities = [];
  assert.deepEqual(tastePayload(tasteDraft(current)).movie_priorities, []);
  current.preferences.runtime_preference = 'no_preference';
  assert.equal(tastePayload(tasteDraft(current)).runtime_preference, 'no_preference');
  current.preferences.runtime_preference = null;
  assert.equal(tastePayload(tasteDraft(current)).runtime_preference, null);
});

test('genre overlap, selection limits, invalid scales and outside reactions are rejected', () => {
  const draft = tasteDraft(snapshot());
  assert.equal(validMovieTaste({ ...draft, disliked_genres: [GENRE] }), false);
  assert.equal(validMovieTaste({ ...draft, movie_priorities: ['story', 'pace', 'music', 'humor'] }), false);
  assert.equal(validMovieTaste({ ...draft, movie_priorities: ['story', 'story'] }), false);
  assert.equal(validMovieTaste({ ...draft, trash_tolerance: 0 }), false);
  assert.equal(validMovieTaste({ ...draft, movie_knowledge_self_rating: 11 }), false);
  assert.equal(validMovieTaste({ ...draft, movie_reactions: { [OUTSIDE_MOVIE]: 1 } }), false);
});

test('set ordering is not an edit, while a changed choice is', () => {
  const draft = tasteDraft(snapshot());
  const left = tastePayload({ ...draft, movie_priorities: ['story', 'pace'] });
  assert.equal(sameTaste(left, tastePayload({ ...draft, movie_priorities: ['pace', 'story'] })), true);
  assert.equal(sameTaste(left, tastePayload(draft)), false);
});

test('RPC parsing preserves all reactions and rejects incomplete or cross-version metadata', () => {
  const current = snapshot();
  const raw = { user_id: current.userId, revision: 12, preferences: current.preferences, genres: current.genres,
    editable_movie_ids: current.editableMovieIds,
    movies: current.movies.map((m) => ({ id: m.id, title: m.title, poster_path: '/poster.jpg', release_date: null })) };
  const parsed = parseMovieTaste(raw, (path) => 'poster:' + path);
  assert.equal(parsed.preferences.movie_reactions[OUTSIDE_MOVIE], -1);
  assert.equal(parsed.movies[0].posterUrl, 'poster:/poster.jpg');
  assert.throws(() => parseMovieTaste({ ...raw, editable_movie_ids: [] }, String));
  assert.throws(() => parseMovieTaste({ ...raw, movies: [] }, String));
  assert.throws(() => parseMovieTaste({ ...raw, revision: -1 }, String));
  assert.throws(() => parseMovieTaste({ ...raw, preferences: { ...raw.preferences, runtime_preference: 'wrong' } }, String));
});
