import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';
import authReducer, { setAuth } from '../../store/authSlice.ts';
import personalReducer, { loadDailyMovies, type DailyMovieServices } from '../../store/dailyMoviesSlice.ts';
import sharedReducer, { loadSharedDailyMovies, type SharedDailyMovieServices } from '../../store/sharedDailyMoviesSlice.ts';
import type { DailyMovieFeed } from '../../types/movie';
import { deferred } from '../movie-taste/testFixtures.ts';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
function user(id: string): User { return { id, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' }; }
function feed(id: string, personal = false): DailyMovieFeed {
  return { userId: id, today: '2026-11-06', status: personal ? 'assigned' : 'legacy', items: [{
    scheduledDate: '2026-11-06', source: personal ? 'personal' : 'shared', movie: {
      id: personal ? id : 'shared-film', title: personal ? id : 'Shared movie',
      description: 'fixture', posterUrl: '/fixture', tmdbRating: 4,
    },
  }] };
}
function harness() {
  const calls = { shared: 0, personal: 0 };
  const services: DailyMovieServices & SharedDailyMovieServices = {
    fetchDailyMovieFeed: async (id) => { calls.personal++; return feed(id, true); },
    fetchSharedDailyMovieFeed: async (id) => { calls.shared++; return feed(id); },
  };
  const store = configureStore({ reducer: { auth: authReducer, dailyMovies: personalReducer, sharedDailyMovies: sharedReducer },
    middleware: (defaults) => defaults({ thunk: { extraArgument: services } }) });
  store.dispatch(setAuth(user(A)));
  const session = () => ({ userId: store.getState().auth.user!.id, sessionGeneration: store.getState().auth.sessionGeneration });
  return { store, services, calls, session };
}

test('Home reads the same shared movie for both accounts without invoking the assignment service', async () => {
  const h = harness();
  assert.deepEqual(h.calls, { shared: 0, personal: 0 });
  await h.store.dispatch(loadSharedDailyMovies(h.session())).unwrap();
  const movieA = h.store.getState().sharedDailyMovies.feed!.items[0].movie.id;
  h.store.dispatch(setAuth(user(B)));
  assert.equal(h.store.getState().sharedDailyMovies.feed, null);
  await h.store.dispatch(loadSharedDailyMovies(h.session())).unwrap();
  assert.equal(h.store.getState().sharedDailyMovies.feed!.items[0].movie.id, movieA);
  assert.equal(h.store.getState().dailyMovies.feed, null);
  assert.deepEqual(h.calls, { shared: 2, personal: 0 });
});

test('opening personal recommendations cannot replace Home; returning Home does not request another assignment', async () => {
  const h = harness();
  await h.store.dispatch(loadSharedDailyMovies(h.session())).unwrap();
  await h.store.dispatch(loadDailyMovies(h.session())).unwrap();
  assert.equal(h.store.getState().dailyMovies.feed!.items[0].movie.id, A);
  assert.equal(h.store.getState().sharedDailyMovies.feed!.items[0].movie.id, 'shared-film');
  await h.store.dispatch(loadSharedDailyMovies(h.session())).unwrap();
  assert.deepEqual(h.calls, { shared: 2, personal: 1 });
  assert.equal(h.store.getState().dailyMovies.feed!.items[0].movie.id, A);
});

test('a previous account shared response cannot replace the new account feed or personal cache', async () => {
  const h = harness(); const pending = deferred<DailyMovieFeed>();
  h.services.fetchSharedDailyMovieFeed = () => pending.promise;
  const old = h.store.dispatch(loadSharedDailyMovies(h.session()));
  h.store.dispatch(setAuth(user(B)));
  h.services.fetchSharedDailyMovieFeed = async (id) => feed(id);
  await h.store.dispatch(loadSharedDailyMovies(h.session())).unwrap();
  await h.store.dispatch(loadDailyMovies(h.session())).unwrap();
  pending.resolve(feed(A)); await old;
  assert.equal(h.store.getState().sharedDailyMovies.feed?.userId, B);
  assert.equal(h.store.getState().dailyMovies.feed?.userId, B);
});
