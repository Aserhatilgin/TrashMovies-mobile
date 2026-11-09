import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';
import authReducer, { setAuth } from '../../store/authSlice.ts';
import dailyMoviesReducer, { loadDailyMovies, type DailyMovieServices } from '../../store/dailyMoviesSlice.ts';
import sharedReducer, { loadSharedDailyMovies } from '../../store/sharedDailyMoviesSlice.ts';
import type { DailyMovieFeed } from '../../types/movie';
import { deferred } from '../movie-taste/testFixtures.ts';
import { istanbulDate } from '../../utils/istanbulDate.ts';
import { startDailyMovieRefresh } from './focusRefresh.ts';
import { dailyMoviePresentation } from './presentation.ts';

const userId = '10000000-0000-4000-8000-000000000001';
const user: User = { id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' };
function feed(day: string, days = [day]): DailyMovieFeed {
  return { userId, today: day, status: 'assigned', items: days.map((scheduledDate) => ({
    scheduledDate, source: 'personal', movie: {
      id: scheduledDate, title: scheduledDate, description: 'fixture', posterUrl: '/fixture', tmdbRating: 4,
    },
  })) };
}
function harness() {
  const services: DailyMovieServices & { fetchSharedDailyMovieFeed: DailyMovieServices['fetchDailyMovieFeed'] } = {
    fetchDailyMovieFeed: async () => feed('2026-11-08', ['2026-11-07', '2026-11-08']),
    fetchSharedDailyMovieFeed: async () => ({ ...feed('2026-11-08'), status: 'legacy' }),
  };
  const store = configureStore({
    reducer: { auth: authReducer, dailyMovies: dailyMoviesReducer, sharedDailyMovies: sharedReducer },
    middleware: (defaults) => defaults({ thunk: { extraArgument: services } }),
  });
  store.dispatch(setAuth(user));
  const session = () => ({ userId, sessionGeneration: store.getState().auth.sessionGeneration });
  const load = () => store.dispatch(loadDailyMovies(session()));
  return { services, store, session, load };
}

test('Istanbul midnight removes yesterday immediately; failed refresh preserves history; retry shows only the new day', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-11-08T20:59:59.999Z') });
  const h = harness();
  await h.store.dispatch(loadSharedDailyMovies(h.session())).unwrap();
  const sharedHistory = h.store.getState().sharedDailyMovies.feed;
  let today = '';
  const requests: ReturnType<typeof h.load>[] = [];
  const stop = startDailyMovieRefresh({
    load: () => { const request = h.load(); requests.push(request); return request; },
    onDateChange: (date) => { today = date; }, subscribeActive: () => () => {},
  });
  t.after(stop);
  await requests[0].unwrap();
  const history = h.store.getState().dailyMovies.feed!.items;
  const view = () => dailyMoviePresentation(h.store.getState().dailyMovies.feed, today);
  assert.equal(today, '2026-11-08');
  assert.deepEqual(view().todayMovies.map((item) => item.scheduledDate), ['2026-11-08']);

  const refresh = deferred<void>();
  h.services.fetchDailyMovieFeed = async () => { await refresh.promise; throw new Error('network unavailable'); };
  t.mock.timers.tick(1); // 21:00 UTC == 00:00 Europe/Istanbul, not UTC midnight.
  assert.equal(today, '2026-11-09');
  assert.equal(requests.length, 2);
  assert.deepEqual(view().todayMovies, []);
  assert.equal(view().todayStatus, undefined);
  assert.deepEqual(view().dailyMovies, history);
  assert.notEqual(h.store.getState().dailyMovies.requestId, null);

  refresh.resolve();
  await assert.rejects(requests[1].unwrap());
  assert.equal(h.store.getState().dailyMovies.hasError, true); // Existing error/retry banner.
  assert.equal(h.store.getState().dailyMovies.requestId, null);
  assert.deepEqual(view().todayMovies, []);
  assert.deepEqual(view().dailyMovies, history);
  assert.deepEqual(h.store.getState().sharedDailyMovies.feed, sharedHistory);

  h.services.fetchDailyMovieFeed = async () => feed('2026-11-09', ['2026-11-07', '2026-11-08', '2026-11-09']);
  await h.load().unwrap(); // Same action as the retry button.
  assert.equal(h.store.getState().dailyMovies.hasError, false);
  assert.equal(view().todayStatus, 'assigned');
  assert.deepEqual(view().todayMovies.map((item) => item.scheduledDate), ['2026-11-09']);
  assert.deepEqual(view().dailyMovies.slice(0, 2), history);
  assert.deepEqual(h.store.getState().sharedDailyMovies.feed, sharedHistory);
});

test('foreground after a suspended midnight updates the date before the response; blur aborts and stops future requests', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-11-08T20:30:00Z') });
  const h = harness();
  let today = '', onActive = () => {}, unsubscribed = false;
  const requests: ReturnType<typeof h.load>[] = [];
  const stop = startDailyMovieRefresh({
    load: () => { const request = h.load(); requests.push(request); return request; },
    onDateChange: (date) => { today = date; },
    subscribeActive: (callback) => { onActive = callback; return () => { unsubscribed = true; }; },
  });
  t.after(stop);
  await requests[0].unwrap();
  h.services.fetchDailyMovieFeed = () => deferred<DailyMovieFeed>().promise;
  t.mock.timers.setTime(Date.parse('2026-11-09T03:00:00Z')); // Native timers were suspended.
  onActive();
  assert.equal(today, istanbulDate(new Date()));
  assert.equal(today, '2026-11-09');
  assert.deepEqual(dailyMoviePresentation(h.store.getState().dailyMovies.feed, today).todayMovies, []);
  stop();
  await assert.rejects(requests[1].unwrap(), (error: unknown) =>
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError');
  t.mock.timers.tick(86_400_000);
  onActive(); // A native event already queued at blur must also be harmless.
  assert.equal(unsubscribed, true);
  assert.equal(requests.length, 2);
  assert.equal(h.store.getState().dailyMovies.hasError, false);
});

test('yesterday empty reasons are not presented as today; current empty reasons remain distinct', () => {
  for (const status of ['no_candidate', 'no_shared_movie'] as const) {
    const previous: DailyMovieFeed = { ...feed('2026-11-08'), status, items: [] };
    assert.equal(dailyMoviePresentation(previous, '2026-11-09').todayStatus, undefined);
    assert.equal(dailyMoviePresentation({ ...previous, today: '2026-11-09' }, '2026-11-09').todayStatus, status);
  }
});
