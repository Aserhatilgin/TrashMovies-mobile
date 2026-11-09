import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';
import authReducer, { clearAuth, setAuth } from '../../store/authSlice.ts';
import dailyMoviesReducer, { loadDailyMovies, type DailyMovieServices } from '../../store/dailyMoviesSlice.ts';
import type { DailyMovieFeed } from '../../types/movie';
import { deferred } from '../movie-taste/testFixtures.ts';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
function user(id: string): User { return { id, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' }; }
function feed(userId = A): DailyMovieFeed {
  return { userId, today: '2026-11-06', status: 'assigned', items: [{ scheduledDate: '2026-11-06', source: 'personal',
    movie: { id: userId, title: userId, description: 'fixture', posterUrl: '/poster', tmdbRating: 4 } }] };
}
function harness() {
  const services: DailyMovieServices = { fetchDailyMovieFeed: async (id) => feed(id) };
  const store = configureStore({ reducer: { auth: authReducer, dailyMovies: dailyMoviesReducer },
    middleware: (defaults) => defaults({ thunk: { extraArgument: services } }) });
  store.dispatch(setAuth(user(A)));
  const load = () => store.dispatch(loadDailyMovies({ userId: store.getState().auth.user!.id,
    sessionGeneration: store.getState().auth.sessionGeneration }));
  return { store, services, load };
}
test('account switch synchronously removes the previous card and ignores its late response', async () => {
  const h = harness(); await h.load().unwrap();
  const pending = deferred<DailyMovieFeed>(); h.services.fetchDailyMovieFeed = () => pending.promise;
  const old = h.load(); h.store.dispatch(setAuth(user(B)));
  assert.equal(h.store.getState().dailyMovies.feed, null);
  pending.resolve(feed(A)); await old;
  assert.equal(h.store.getState().dailyMovies.feed, null);
  h.services.fetchDailyMovieFeed = async () => feed(B); await h.load().unwrap();
  assert.equal(h.store.getState().dailyMovies.feed?.userId, B);
});
test('logout and re-login as the same user cannot restore an old generation', async () => {
  const h = harness(); const pending = deferred<DailyMovieFeed>(); h.services.fetchDailyMovieFeed = () => pending.promise;
  const old = h.load(); h.store.dispatch(clearAuth()); h.store.dispatch(setAuth(user(A)));
  pending.resolve(feed()); await old;
  assert.equal(h.store.getState().dailyMovies.feed, null);
});
test('a late older request cannot overwrite the latest result', async () => {
  const h = harness(); const pending = deferred<DailyMovieFeed>(); h.services.fetchDailyMovieFeed = () => pending.promise;
  const old = h.load(); h.services.fetchDailyMovieFeed = async () => ({ ...feed(), status: 'no_candidate', items: [] });
  await h.load().unwrap(); pending.resolve(feed()); await old;
  assert.equal(h.store.getState().dailyMovies.feed?.status, 'no_candidate');
});
test('query failure is an error, never an empty pool; same-user cached history survives retry errors', async () => {
  const h = harness(); await h.load().unwrap();
  h.services.fetchDailyMovieFeed = async () => { throw new Error('database unavailable'); };
  await assert.rejects(h.load().unwrap());
  assert.equal(h.store.getState().dailyMovies.hasError, true);
  assert.equal(h.store.getState().dailyMovies.feed?.status, 'assigned');
  h.store.dispatch(setAuth(user(B))); await assert.rejects(h.load().unwrap());
  assert.equal(h.store.getState().dailyMovies.feed, null);
  assert.equal(h.store.getState().dailyMovies.hasError, true);
});
test('empty reasons stay distinct; same-user token refresh preserves the assigned card', async () => {
  const h = harness(); await h.load().unwrap(); h.store.dispatch(setAuth(user(A)));
  assert.equal(h.store.getState().dailyMovies.feed?.userId, A);
  for (const status of ['no_candidate', 'no_shared_movie'] as const) {
    h.services.fetchDailyMovieFeed = async () => ({ ...feed(), status, items: [] });
    await h.load().unwrap();
    assert.equal(h.store.getState().dailyMovies.feed?.status, status);
    assert.equal(h.store.getState().dailyMovies.hasError, false);
  }
});
