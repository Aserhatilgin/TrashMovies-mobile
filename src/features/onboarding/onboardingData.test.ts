import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPROVED_MOVIE_IDS, hydrateDraft, reconcileDraftGenres, validStep,
  moviePageAction, nextStep, previousStep, skipOptionalStep,
} from './onboardingV1.ts';
import { loadOnboardingMovieRows, type OnboardingMovieSource } from './onboardingMovies.ts';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const genres = [{ id: a }, { id: b }, { id: c }];

test('hydrated unknown liked IDs are removed while real choices survive', () => {
  const loaded = hydrateDraft({ liked_genres: [a, 'not-a-uuid', '11111111-1111-4111-8111-111111111111'] });
  const clean = reconcileDraftGenres(loaded, genres);
  assert.deepEqual(clean.liked_genres, [a]);
  assert.equal(loaded.liked_genres?.length, 3); // No mutation or implicit persistence.
});

test('five stale liked IDs no longer consume limits; no fake like is supplied', () => {
  const clean = reconcileDraftGenres(hydrateDraft({ liked_genres: ['one', 'two', 'three', 'four', 'five'] }), genres);
  assert.deepEqual(clean.liked_genres, []);
  assert.equal(validStep('liked_genres', clean), false);
  assert.equal(validStep('liked_genres', { ...clean, liked_genres: [a] }), true);
});

test('mixed-case genre IDs canonicalize and deduplicate against database IDs', () => {
  const clean = reconcileDraftGenres(hydrateDraft({ liked_genres: [a.toUpperCase(), a, b.toUpperCase()] }), genres);
  assert.deepEqual(clean.liked_genres, [a, b]);
});

test('likes win over overlapping historic dislikes and omissions stay omitted', () => {
  const clean = reconcileDraftGenres(hydrateDraft({ liked_genres: [a.toUpperCase()], disliked_genres: [a, b, c] }), genres);
  assert.deepEqual(clean.disliked_genres, [b, c]);
  assert.equal(validStep('disliked_genres', clean), true);
  assert.deepEqual(reconcileDraftGenres({}, genres), {});
});

for (const [page, target] of [[0, 1], [1, 2], [2, null]] as const) {
  test('movie group ' + (page + 1) + ' primary action selects the proper group/question', () => {
    assert.equal(moviePageAction(page, 'next'), target);
    if (target === null) assert.equal(nextStep('movie_reactions'), 'exploration_preferences');
  });
}
for (const [page, target] of [[2, 1], [1, 0], [0, null]] as const) {
  test('movie group ' + (page + 1) + ' Back selects the proper group/question', () => {
    assert.equal(moviePageAction(page, 'back'), target);
    if (target === null) assert.equal(previousStep('movie_reactions'), 'disliked_genres');
  });
}

test('movie group navigation preserves reactions; question Skip removes them', () => {
  const draft = hydrateDraft({ movie_reactions: { [APPROVED_MOVIE_IDS[0]]: 1, [APPROVED_MOVIE_IDS[8]]: -1 } });
  moviePageAction(0, 'next'); moviePageAction(1, 'back');
  assert.equal(Object.keys(draft.movie_reactions!).length, 2);
  assert.equal(skipOptionalStep(draft, 'movie_reactions').movie_reactions, undefined);
  assert.equal(nextStep('movie_reactions'), 'exploration_preferences');
});

function movieSource(): OnboardingMovieSource {
  return {
    positions: async () => APPROVED_MOVIE_IDS.map((movie_id, index) => ({ movie_id, position: index + 1 })),
    movies: async (ids) => ids.map((id) => ({ id, title: id, poster_path: '/poster.jpg', release_date: '2000-01-01' })).reverse(),
  };
}

test('preview reads exact approved UUIDs and works with an empty versioned set', async () => {
  const source = movieSource(); let positionReads = 0;
  source.positions = async () => { positionReads++; return []; };
  const read = source.movies;
  source.movies = async (ids) => { assert.deepEqual(ids, APPROVED_MOVIE_IDS); return read(ids); };
  const rows = await loadOnboardingMovieRows(true, source);
  assert.equal(positionReads, 0);
  assert.deepEqual(rows.map((row) => row.id), APPROVED_MOVIE_IDS);
});

test('real mode validates the versioned identities and ordering before movie reads', async () => {
  const source = movieSource(); let movieReads = 0;
  source.positions = async () => APPROVED_MOVIE_IDS.map((movie_id, index) => ({
    movie_id: index === 0 ? APPROVED_MOVIE_IDS[1] : index === 1 ? APPROVED_MOVIE_IDS[0] : movie_id,
    position: index + 1,
  }));
  source.movies = async () => { movieReads++; return []; };
  await assert.rejects(loadOnboardingMovieRows(false, source), /configured as approved/);
  assert.equal(movieReads, 0);
});

test('real mode accepts the exact curated set and rejects absent positions', async () => {
  const source = movieSource();
  assert.equal((await loadOnboardingMovieRows(false, source)).length, 15);
  source.positions = async () => [];
  await assert.rejects(loadOnboardingMovieRows(false, source));
});

test('one missing poster does not discard any curated movie identity', async () => {
  const source = movieSource(); const read = source.movies;
  source.movies = async (ids) => (await read(ids)).map((row, index) => ({ ...row, poster_path: index === 0 ? null : row.poster_path }));
  const rows = await loadOnboardingMovieRows(true, source);
  assert.equal(rows.length, 15); assert.equal(rows.filter((row) => row.poster_path === null).length, 1);
});
