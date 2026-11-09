import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';
import authReducer, { clearAuth, setAuth } from '../../store/authSlice.ts';
import movieTasteReducer, { clearTasteSaveError, loadMovieTaste, persistMovieTaste, selectTasteRevision, type MovieTasteServices } from '../../store/movieTasteSlice.ts';
import { tasteDraft, tastePayload } from './model.ts';
import { deferred, snapshot, USER_A, USER_B } from './testFixtures.ts';
import type { MovieTasteSnapshot } from '../../types/movieTaste';

function user(id: string): User { return { id, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' }; }
function harness() {
  const services: MovieTasteServices = { fetchMovieTaste: async () => snapshot(), saveMovieTaste: async () => snapshot(USER_A, 1) };
  const store = configureStore({ reducer: { auth: authReducer, movieTaste: movieTasteReducer },
    middleware: (defaults) => defaults({ thunk: { extraArgument: services } }) });
  store.dispatch(setAuth(user(USER_A)));
  const session = () => ({ userId: store.getState().auth.user!.id, sessionGeneration: store.getState().auth.sessionGeneration });
  return { store, services, session,
    load: () => store.dispatch(loadMovieTaste(session())),
    save: (revision = 0) => store.dispatch(persistMovieTaste({ ...session(), revision, preferences: tastePayload(tasteDraft(snapshot())) })) };
}

test('successful save replaces the summary with server values and exposes the taste generation', async () => {
  const h = harness(); await h.load().unwrap();
  h.services.saveMovieTaste = async () => { const result = snapshot(USER_A, 7); result.preferences.trash_tolerance = 5; return result; };
  await h.save().unwrap();
  assert.equal(h.store.getState().movieTaste.snapshot?.preferences.trash_tolerance, 5);
  assert.equal(selectTasteRevision(h.store.getState()), 7);
});

test('successful changed save clears a previous refresh error after an initial load', async () => {
  const h = harness();
  const initial = await h.load().unwrap();
  assert.equal(h.store.getState().movieTaste.loadError, false);

  h.services.fetchMovieTaste = async () => { throw new Error('refresh unavailable'); };
  await assert.rejects(h.load().unwrap());
  assert.equal(h.store.getState().movieTaste.loadError, true);
  assert.deepEqual(h.store.getState().movieTaste.snapshot, initial);

  const draft = tasteDraft(initial);
  draft.trash_tolerance = 5;
  const preferences = tastePayload(draft);
  const updated = snapshot(USER_A, initial.revision + 1);
  updated.preferences.trash_tolerance = 5;
  h.services.saveMovieTaste = async (userId, revision, submitted) => {
    assert.equal(userId, USER_A);
    assert.equal(revision, initial.revision);
    assert.deepEqual(submitted, preferences);
    return updated;
  };
  await h.store.dispatch(persistMovieTaste({ ...h.session(), revision: initial.revision, preferences })).unwrap();

  const state = h.store.getState().movieTaste;
  assert.deepEqual(state.snapshot, updated);
  assert.equal(state.loadError, false);
  assert.equal(state.saveError, null);
});

test('a late pre-save read and a lower-revision refresh cannot replace a committed save', async () => {
  const h = harness(); await h.load().unwrap();
  const old = deferred<MovieTasteSnapshot>(); h.services.fetchMovieTaste = () => old.promise;
  const reading = h.load(); await h.save().unwrap();
  old.resolve(snapshot()); await reading;
  assert.equal(selectTasteRevision(h.store.getState()), 1);
  h.services.fetchMovieTaste = async () => snapshot(); await h.load().unwrap();
  assert.equal(selectTasteRevision(h.store.getState()), 1);
});

test('duplicate save taps invoke only one write', async () => {
  const h = harness(); const waiting = deferred<MovieTasteSnapshot>(); let writes = 0;
  h.services.saveMovieTaste = async () => { writes++; return waiting.promise; };
  const first = h.save(); const duplicate = await h.save();
  assert.equal(persistMovieTaste.rejected.match(duplicate), true); assert.equal(writes, 1);
  waiting.resolve(snapshot(USER_A, 1)); await first.unwrap();
});

test('revision conflict and failed save preserve the loaded snapshot and caller draft', async () => {
  const h = harness(); await h.load().unwrap();
  const draft = tasteDraft(snapshot()); const before = structuredClone(draft);
  h.services.fetchMovieTaste = async () => { throw new Error('refresh unavailable'); };
  await assert.rejects(h.load().unwrap());
  h.services.saveMovieTaste = async () => { throw { code: '40001' }; };
  await assert.rejects(h.save().unwrap());
  assert.equal(h.store.getState().movieTaste.saveError, 'conflict');
  assert.equal(h.store.getState().movieTaste.loadError, true);
  h.services.saveMovieTaste = async () => { throw new Error('network'); };
  h.services.fetchMovieTaste = async () => { throw new Error('offline'); };
  await assert.rejects(h.save().unwrap());
  assert.equal(h.store.getState().movieTaste.saveError, 'save');
  assert.equal(h.store.getState().movieTaste.loadError, true);
  assert.equal(selectTasteRevision(h.store.getState()), 0); assert.deepEqual(draft, before);
});

test('lost committed response reconciles through the current normalized snapshot without another write', async () => {
  const h = harness(); let writes = 0;
  h.services.saveMovieTaste = async () => { writes++; throw new Error('lost response'); };
  h.services.fetchMovieTaste = async () => snapshot(USER_A, 1);
  await h.save().unwrap();
  assert.equal(writes, 1); assert.equal(selectTasteRevision(h.store.getState()), 1);
});

test('a changed remote taste after a lost response requires an explicit conflict reload', async () => {
  const h = harness(); await h.load().unwrap();
  h.services.saveMovieTaste = async () => { throw new Error('lost response'); };
  h.services.fetchMovieTaste = async () => { const next = snapshot(USER_A, 2); next.preferences.trash_tolerance = 5; return next; };
  await assert.rejects(h.save().unwrap());
  assert.equal(h.store.getState().movieTaste.saveError, 'conflict');
  assert.equal(selectTasteRevision(h.store.getState()), 0);
  await h.load().unwrap();
  h.store.dispatch(clearTasteSaveError(h.session()));
  assert.equal(selectTasteRevision(h.store.getState()), 2);
  assert.equal(h.store.getState().movieTaste.saveError, null);
});

test('aborting a pending save leaves its late result unable to change current state', async () => {
  const h = harness(); await h.load().unwrap(); const waiting = deferred<MovieTasteSnapshot>();
  h.services.saveMovieTaste = () => waiting.promise;
  const request = h.save(); request.abort(); await request;
  waiting.resolve(snapshot(USER_A, 8)); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(selectTasteRevision(h.store.getState()), 0);
  assert.equal(h.store.getState().movieTaste.saveRequestId, null);
});

for (const action of ['read', 'save'] as const) {
  for (const change of ['switch', 'same-user-login'] as const) {
    test(`${action} from an old ${change} session cannot affect new-session state`, async () => {
      const h = harness(); const old = deferred<MovieTasteSnapshot>();
      if (action === 'read') h.services.fetchMovieTaste = () => old.promise;
      else h.services.saveMovieTaste = () => old.promise;
      const request = action === 'read' ? h.load() : h.save();
      h.store.dispatch(clearAuth()); h.store.dispatch(setAuth(user(change === 'switch' ? USER_B : USER_A)));
      h.services.fetchMovieTaste = async () => snapshot(change === 'switch' ? USER_B : USER_A, 3);
      await h.load().unwrap(); old.resolve(snapshot(USER_A, 9)); await request;
      assert.equal(h.store.getState().movieTaste.snapshot?.userId, change === 'switch' ? USER_B : USER_A);
      assert.equal(selectTasteRevision(h.store.getState()), 3);
      assert.equal(h.store.getState().movieTaste.saveError, null);
    });
  }
}

test('aborted operation and wrong-owner response do not update the snapshot', async () => {
  const h = harness(); const old = deferred<MovieTasteSnapshot>();
  h.services.fetchMovieTaste = () => old.promise;
  const request = h.load(); request.abort(); old.resolve(snapshot()); await request;
  assert.equal(h.store.getState().movieTaste.snapshot, null);
  h.services.fetchMovieTaste = async () => snapshot(USER_B);
  await assert.rejects(h.load().unwrap()); assert.equal(h.store.getState().movieTaste.snapshot, null);
});

test('token refresh for the same user retains current taste and session generation', async () => {
  const h = harness(); await h.load().unwrap(); const generation = h.session().sessionGeneration;
  h.store.dispatch(setAuth(user(USER_A)));
  assert.equal(h.session().sessionGeneration, generation);
  assert.equal(h.store.getState().movieTaste.snapshot?.userId, USER_A);
});
