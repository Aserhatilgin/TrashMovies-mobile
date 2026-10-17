import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';

import authReducer, { clearAuth, setAuth } from '../../store/authSlice.ts';
import userDomainReducer, { initializeUserDomainForSession } from '../../store/userDomainSlice.ts';
import { resolveAppRoute } from '../../store/userDomainRouting.ts';
import { OnboardingOperations } from './onboardingOperations.ts';
import type { UserDomainBootstrap, UserOnboardingProgress } from '../../services/userDomain';

function user(id = 'A'): User {
  return { id, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' };
}

function progress(id = 'A', completed = false, revision = 0): UserOnboardingProgress {
  return {
    userId: id, onboardingVersion: 1, currentStep: 'demographics', responses: { display_name: id },
    revision, startedAt: '2026-10-17', completedAt: completed ? '2026-10-17' : null,
    completionSource: completed ? 'user' : null, createdAt: '', updatedAt: '',
  };
}

function domain(id = 'A', completed = false): UserDomainBootstrap {
  return {
    profile: { id, displayName: id, avatarKey: 'avatar_16', createdAt: '', updatedAt: '' },
    onboarding: {
      requiredVersion: 1, requiredCompleted: completed, latestVersion: 1, latestCompleted: completed,
      status: completed ? 'completed' : 'in_progress',
      requiredProgress: progress(id, completed), latestProgress: progress(id, completed),
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

function harness() {
  let remoteCompleted = false;
  let calls = 0;
  let initialize = async (_signal?: AbortSignal) => domain('A', remoteCompleted);
  const store = configureStore({
    reducer: { auth: authReducer, userDomain: userDomainReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      thunk: { extraArgument: {
        initializeUserDomain: (signal?: AbortSignal) => { calls++; return initialize(signal); },
      } },
    }),
  });
  store.dispatch(setAuth(user()));
  const request = (refresh = false, signal?: AbortSignal) => {
    const auth = store.getState().auth;
    return store.dispatch(initializeUserDomainForSession({
      userId: auth.user!.id, sessionGeneration: auth.sessionGeneration, refresh,
    }, { signal }));
  };
  const route = () => {
    const state = store.getState();
    return resolveAppRoute({ isInitialized: state.auth.isInitialized, userId: state.auth.user?.id ?? null }, state.userDomain);
  };
  const operations = () => {
    const { sessionGeneration, user: owner } = store.getState().auth;
    const instance = new OnboardingOperations(owner!.id, false, {
      currentUserId: () => {
        const auth = store.getState().auth;
        return auth.sessionGeneration === sessionGeneration ? auth.user?.id ?? null : null;
      },
      initialize: (signal) => store.dispatch(initializeUserDomainForSession({
        userId: owner!.id, sessionGeneration, refresh: true,
      }, { signal })).unwrap(),
      save: async (_version, revision, responses, step) => ({
        ...progress(owner!.id, false, revision + 1), currentStep: step, responses: { ...responses },
      }),
      complete: async (_version, revision) => {
        remoteCompleted = true;
        return progress(owner!.id, true, revision + 1);
      },
    });
    instance.activate();
    return instance;
  };
  return {
    store, request, route, operations, calls: () => calls,
    completeRemotely: () => { remoteCompleted = true; },
    service: (next: typeof initialize) => { initialize = next; },
  };
}

test('final CTA refreshes stale Redux before one onboarding-to-Main route transition', async () => {
  const h = harness();
  await h.request().unwrap();
  const operations = h.operations();
  await operations.initialize();
  assert.equal(h.route(), 'onboarding');

  // Completion alone must keep Taste Profile available until its final CTA.
  assert.equal((await operations.submit({ display_name: 'A' }, 'demographics', true))?.kind, 'completed');
  assert.equal(h.store.getState().userDomain.requiredCompleted, false);
  assert.equal(h.route(), 'onboarding');

  const routes: string[] = [h.route()];
  let onboardingExits = 0;
  let onboardingReentries = 0;
  const unsubscribe = h.store.subscribe(() => {
    const next = h.route();
    const previous = routes.at(-1);
    if (previous === next) return;
    if (previous === 'onboarding') onboardingExits++;
    if (next === 'onboarding') onboardingReentries++;
    routes.push(next);
  });
  const before = h.calls();
  await operations.initialize(); // Same canonical refresh used by the final CTA.
  assert.equal(h.store.getState().userDomain.status, 'ready');
  assert.equal(h.store.getState().userDomain.requiredCompleted, true);
  assert.deepEqual(routes, ['onboarding', 'main']);
  assert.equal(onboardingExits, 1);
  assert.equal(onboardingReentries, 0);
  assert.equal(h.calls(), before + 1);
  await Promise.resolve();
  assert.equal(h.calls(), before + 1, 'Routing must not trigger another refresh loop');
  unsubscribe();
});

test('failed CTA refresh keeps the ready incomplete route and allows a successful retry', async () => {
  const h = harness(); await h.request().unwrap();
  const operations = h.operations(); await operations.initialize();
  await operations.submit({ display_name: 'A' }, 'demographics', true);
  const failure = new Error('Offline');
  h.service(async () => { throw failure; });
  const routes = [h.route()];
  const unsubscribe = h.store.subscribe(() => { routes.push(h.route()); });
  await assert.rejects(operations.initialize(), { message: 'Offline' });
  assert.ok(routes.every((route) => route === 'onboarding'), 'Taste Profile must not be removed for loading/error');
  assert.equal(h.store.getState().userDomain.status, 'ready');
  assert.equal(h.store.getState().userDomain.requiredCompleted, false);
  assert.equal(h.store.getState().auth.user?.id, 'A');
  h.service(async () => domain('A', true));
  await operations.initialize();
  assert.equal(h.route(), 'main');
  unsubscribe();
});

test('already-completed onboarding bootstrap updates canonical Redux with one refresh', async () => {
  const h = harness(); await h.request().unwrap();
  h.completeRemotely();
  const before = h.calls();
  const routes = [h.route()];
  const unsubscribe = h.store.subscribe(() => { if (routes.at(-1) !== h.route()) routes.push(h.route()); });
  assert.equal((await h.operations().initialize())?.onboarding.requiredCompleted, true);
  assert.deepEqual(routes, ['onboarding', 'main']);
  assert.equal(h.calls(), before + 1);
  unsubscribe();
});

test('same-user app restart bootstraps completed state directly to Main', async () => {
  const h = harness(); h.completeRemotely();
  assert.equal(h.route(), 'loading');
  await h.request().unwrap();
  assert.equal(h.route(), 'main');
  assert.equal(h.calls(), 1);
  h.store.dispatch(clearAuth()); h.store.dispatch(setAuth(user()));
  await h.request().unwrap();
  assert.equal(h.route(), 'main');
  assert.equal(h.calls(), 2);
});

test('user A refresh cannot overwrite user B routing state', async () => {
  const h = harness(); await h.request().unwrap();
  const waiting = deferred<UserDomainBootstrap>(); h.service(async () => waiting.promise);
  const old = h.request(true).unwrap();
  const rejected = assert.rejects(old);
  h.store.dispatch(setAuth(user('B')));
  h.service(async () => domain('B', false));
  await h.request().unwrap();
  waiting.resolve(domain('A', true)); await rejected;
  assert.equal(h.store.getState().userDomain.userId, 'B');
  assert.equal(h.store.getState().userDomain.requiredCompleted, false);
  assert.equal(h.route(), 'onboarding');
});

test('same-user logout/login rejects the previous session generation refresh', async () => {
  const h = harness(); await h.request().unwrap();
  const waiting = deferred<UserDomainBootstrap>(); h.service(async () => waiting.promise);
  const old = h.request(true).unwrap(); const rejected = assert.rejects(old);
  h.store.dispatch(clearAuth()); h.store.dispatch(setAuth(user()));
  h.service(async () => domain('A', false)); await h.request().unwrap();
  waiting.resolve(domain('A', true)); await rejected;
  assert.equal(h.store.getState().userDomain.requiredCompleted, false);
  assert.equal(h.route(), 'onboarding');
});

test('mismatched refresh identity cannot mark current-user onboarding complete', async () => {
  const h = harness(); await h.request().unwrap();
  h.service(async () => domain('B', true));
  await assert.rejects(h.request(true).unwrap());
  assert.equal(h.store.getState().userDomain.userId, 'A');
  assert.equal(h.store.getState().userDomain.requiredCompleted, false);
  assert.equal(h.route(), 'onboarding');
});

test('restarted controller refresh supersedes an aborted request without getting stuck loading', async () => {
  const h = harness(); await h.request().unwrap();
  const waiting = deferred<UserDomainBootstrap>(); h.service(async () => waiting.promise);
  const abort = new AbortController();
  const old = h.request(true, abort.signal).unwrap(); const rejected = assert.rejects(old);
  abort.abort();
  // React effect cleanup/setup can start the next refresh before rejection settles.
  h.service(async () => domain('A', true));
  await h.request(true).unwrap();
  waiting.resolve(domain('A', false)); await rejected;
  assert.equal(h.store.getState().userDomain.activeRequestId, null);
  assert.equal(h.route(), 'main');
});

test('superseded refresh response cannot replace the latest authoritative routing decision', async () => {
  const h = harness(); await h.request().unwrap();
  const waiting = deferred<UserDomainBootstrap>(); h.service(async () => waiting.promise);
  const old = h.request(true).unwrap(); const rejected = assert.rejects(old);
  h.service(async () => domain('A', false)); await h.request(true).unwrap();
  waiting.resolve(domain('A', true)); await rejected;
  assert.equal(h.route(), 'onboarding');
  assert.equal(h.store.getState().userDomain.activeRequestId, null);
});

test('initial bootstrap errors still use the root error route and retry normally', async () => {
  const h = harness(); h.service(async () => { throw new Error('Offline'); });
  await assert.rejects(h.request().unwrap());
  assert.equal(h.route(), 'error');
  h.service(async () => domain('A', true)); await h.request().unwrap();
  assert.equal(h.route(), 'main');
});
