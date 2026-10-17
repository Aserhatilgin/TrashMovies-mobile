import assert from 'node:assert/strict';
import test from 'node:test';
import { OnboardingOperations, ObsoleteOnboardingOperation, type OnboardingServices } from './onboardingOperations.ts';
import type { UserDomainBootstrap, UserOnboardingProgress } from '../../services/userDomain';
import type { OnboardingDraft } from './onboardingV1.ts';

const draft: OnboardingDraft = { display_name: ' A ', avatar_choice: 'avatar_01' };
function progress(revision = 0, completed = false): UserOnboardingProgress {
  return { userId: 'A', onboardingVersion: 1, currentStep: 'avatar_choice', responses: { ...draft },
    revision, startedAt: '2026-10-01', completedAt: completed ? '2026-10-02' : null,
    completionSource: completed ? 'user' : null, createdAt: '2026-10-01', updatedAt: '2026-10-01' };
}
function domain(completed = false): UserDomainBootstrap {
  return { profile: { id: 'A', displayName: 'A', avatarKey: 'avatar_01', createdAt: '', updatedAt: '' },
    onboarding: { requiredVersion: 1, requiredCompleted: completed, latestVersion: 1,
      latestCompleted: completed, status: completed ? 'completed' : 'in_progress',
      requiredProgress: progress(0, completed), latestProgress: progress(0, completed) } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(preview = false) {
  let currentUser: string | null = 'A';
  const calls = { save: 0, complete: 0, initialize: 0 };
  const services: OnboardingServices = {
    currentUserId: () => currentUser,
    initialize: async () => { calls.initialize++; return domain(); },
    save: async (_version, revision, responses, step) => {
      calls.save++; return { ...progress(revision + 1), currentStep: step, responses: { ...responses } };
    },
    complete: async (_version, revision) => { calls.complete++; return progress(revision + 1, true); },
  };
  const operations = new OnboardingOperations('A', preview, services);
  operations.activate();
  return { operations, services, calls, switchUser: (id: string | null) => {
    currentUser = id;
    operations.invalidate(); // Same synchronous invalidation used by the store subscription.
  } };
}

test('save sends next stable step and uses the returned revision for the next save', async () => {
  const h = harness();
  await h.operations.initialize();
  const seen: number[] = [];
  h.services.save = async (version, revision, response, step) => {
    assert.equal(version, 1); assert.equal(response.display_name, 'A'); assert.equal(step, 'avatar_choice');
    seen.push(revision);
    return { ...progress(revision + 7), currentStep: step };
  };
  assert.deepEqual(await h.operations.submit(draft, 'avatar_choice', false), { kind: 'saved', revision: 7 });
  await h.operations.submit(draft, 'avatar_choice', false);
  assert.deepEqual(seen, [0, 7]);
});

test('duplicate Next taps create only one in-flight save', async () => {
  const h = harness(); await h.operations.initialize();
  const waiting = deferred<UserOnboardingProgress>();
  h.services.save = async () => { h.calls.save++; return waiting.promise; };
  const first = h.operations.submit(draft, 'avatar_choice', false);
  assert.equal(await h.operations.submit(draft, 'avatar_choice', false), null);
  assert.equal(h.calls.save, 1);
  waiting.resolve(progress(1)); await first;
  assert.equal(h.operations.busy, false);
});

test('40001 preserves local answers and revision and permits an explicit reload', async () => {
  const h = harness(); await h.operations.initialize();
  const local = structuredClone(draft);
  h.services.save = async () => { throw { code: '40001' }; };
  await assert.rejects(h.operations.submit(local, 'avatar_choice', false), { code: '40001' });
  assert.deepEqual(local, draft); assert.equal(h.operations.revision, 0); assert.equal(h.operations.busy, false);
  h.services.initialize = async () => ({ ...domain(), onboarding: { ...domain().onboarding, requiredProgress: progress(9) } });
  await h.operations.initialize(); assert.equal(h.operations.revision, 9);
});

test('55000 refreshes authoritative completion and never enters a save retry loop', async () => {
  const h = harness(); await h.operations.initialize();
  h.services.save = async () => { h.calls.save++; throw { code: '55000' }; };
  h.services.initialize = async () => { h.calls.initialize++; return domain(true); };
  assert.equal((await h.operations.submit(draft, 'avatar_choice', false))?.kind, 'reconciled');
  await h.operations.submit(draft, 'avatar_choice', false);
  assert.equal(h.calls.save, 1); assert.equal(h.calls.complete, 0); assert.equal(h.calls.initialize, 2);
});

test('55000 without authoritative completion remains an error, never a fake completion', async () => {
  const h = harness(); await h.operations.initialize();
  h.services.save = async () => { throw { code: '55000' }; };
  await assert.rejects(h.operations.submit(draft, 'avatar_choice', false), { code: '55000' });
});

test('initial hydration can discover completion on another device without a write', async () => {
  const h = harness(); h.services.initialize = async () => domain(true);
  assert.equal((await h.operations.initialize())?.onboarding.requiredCompleted, true);
  assert.equal((await h.operations.submit(draft, 'avatar_choice', false))?.kind, 'reconciled');
  assert.equal(h.calls.save + h.calls.complete, 0);
});

test('lost save response retries the same revision and snapshot, allowing SQL exact retry', async () => {
  const h = harness(); await h.operations.initialize();
  const requests: unknown[] = [];
  h.services.save = async (_version, revision, response, step) => {
    requests.push({ revision, response, step });
    if (requests.length === 1) throw new Error('Lost response');
    return progress(1);
  };
  await assert.rejects(h.operations.submit(draft, 'avatar_choice', false));
  assert.equal(h.operations.revision, 0);
  await h.operations.submit(draft, 'avatar_choice', false);
  assert.deepEqual(requests[0], requests[1]); assert.equal(h.operations.revision, 1);
});

test('successful completion returns server responses for the result without refreshing routing', async () => {
  const h = harness(); await h.operations.initialize();
  const response = await h.operations.submit(draft, 'demographics', true);
  assert.equal(response?.kind, 'completed');
  assert.equal(h.calls.initialize, 1); assert.equal(h.calls.complete, 1);
});

test('lost completion response reconciles a committed completion without replaying it', async () => {
  const h = harness(); await h.operations.initialize();
  h.services.complete = async () => { h.calls.complete++; throw new Error('Lost response'); };
  h.services.initialize = async () => domain(true);
  assert.equal((await h.operations.submit(draft, 'demographics', true))?.kind, 'reconciled');
  await h.operations.submit(draft, 'demographics', true);
  assert.equal(h.calls.save, 1); assert.equal(h.calls.complete, 1);
});

test('lost completion plus failed reconciliation followed by Back reconciles before another save', async () => {
  const h = harness(); await h.operations.initialize();
  h.services.complete = async () => { h.calls.complete++; throw new Error('Lost response'); };
  h.services.initialize = async () => { throw new Error('Offline'); };
  await assert.rejects(h.operations.submit(draft, 'demographics', true));
  h.services.initialize = async () => domain(true);
  // Back/edits no longer discard pending uncertainty in the production controller.
  const edited = { ...draft, display_name: 'New answer after Back' };
  assert.equal((await h.operations.submit(edited, 'movie_knowledge_self_rating', false))?.kind, 'reconciled');
  assert.equal(h.calls.save, 1); assert.equal(h.calls.complete, 1);
});

test('an uncommitted completion failure keeps answers and retries complete without resaving', async () => {
  const h = harness(); await h.operations.initialize();
  h.services.complete = async () => {
    h.calls.complete++;
    if (h.calls.complete === 1) throw new Error('Network failure');
    return progress(2, true);
  };
  await assert.rejects(h.operations.submit(draft, 'demographics', true));
  assert.equal((await h.operations.submit(draft, 'demographics', true))?.kind, 'completed');
  assert.equal(h.calls.save, 1); assert.equal(h.calls.complete, 2);
});

test('A save resolving after auth switches to B cannot complete or apply A state', async () => {
  const h = harness(); await h.operations.initialize();
  const waiting = deferred<UserOnboardingProgress>(); let signal: AbortSignal | undefined;
  h.services.save = async (_v, _r, _d, _s, requestSignal) => { signal = requestSignal; return waiting.promise; };
  let applied = false;
  const operation = h.operations.submit(draft, 'demographics', true).then(() => { applied = true; });
  h.switchUser('B'); waiting.resolve({ ...progress(1), currentStep: 'demographics' });
  await assert.rejects(operation, ObsoleteOnboardingOperation);
  assert.equal(signal?.aborted, true); assert.equal(h.calls.complete, 0);
  assert.equal(applied, false); assert.equal(h.operations.revision, 0);
  assert.equal(h.operations.busy, false);
});

for (const reason of ['logout', 'unmount'] as const) {
  test(reason + ' invalidates an awaited network response', async () => {
    const h = harness(); const waiting = deferred<UserDomainBootstrap>();
    h.services.initialize = async () => waiting.promise;
    const operation = h.operations.initialize();
    if (reason === 'logout') h.switchUser(null); else h.operations.invalidate();
    waiting.resolve(domain());
    await assert.rejects(operation, ObsoleteOnboardingOperation);
    assert.equal(h.calls.save + h.calls.complete, 0);
  });
}

test('an old generation cannot unlock or mutate a newly activated generation', async () => {
  const h = harness(); await h.operations.initialize();
  const old = deferred<UserOnboardingProgress>(); const fresh = deferred<UserDomainBootstrap>();
  h.services.save = async () => old.promise;
  const operation = h.operations.submit(draft, 'avatar_choice', false);
  h.operations.invalidate(); h.operations.activate();
  h.services.initialize = async () => fresh.promise;
  const initialization = h.operations.initialize();
  old.resolve(progress(20)); await assert.rejects(operation, ObsoleteOnboardingOperation);
  assert.equal(h.operations.busy, true); assert.equal(h.operations.revision, 0);
  fresh.resolve(domain()); await initialization; assert.equal(h.operations.busy, false);
});

test('preview never invokes initializer, save, or completion services', async () => {
  const h = harness(true);
  await h.operations.initialize();
  await h.operations.submit(draft, 'avatar_choice', false);
  assert.equal((await h.operations.submit(draft, 'demographics', true))?.kind, 'completed');
  assert.deepEqual(h.calls, { save: 0, complete: 0, initialize: 0 });
});

test('auth switch while reconciling completion cannot return a completed outcome', async () => {
  const h = harness(); await h.operations.initialize();
  const waiting = deferred<UserDomainBootstrap>(); const started = deferred<void>();
  h.services.save = async () => { throw { code: '55000' }; };
  h.services.initialize = async () => { started.resolve(); return waiting.promise; };
  const operation = h.operations.submit(draft, 'avatar_choice', false);
  await started.promise;
  h.switchUser('B'); waiting.resolve(domain(true));
  await assert.rejects(operation, ObsoleteOnboardingOperation);
  assert.equal(h.calls.complete, 0);
});

test('completion response after unmount cannot produce a result or start reconciliation', async () => {
  const h = harness(); await h.operations.initialize();
  const waiting = deferred<UserOnboardingProgress>(); const started = deferred<void>();
  h.services.complete = async () => { started.resolve(); return waiting.promise; };
  const operation = h.operations.submit(draft, 'demographics', true);
  await started.promise;
  h.operations.invalidate(); waiting.resolve(progress(2, true));
  await assert.rejects(operation, ObsoleteOnboardingOperation);
  assert.equal(h.calls.initialize, 1);
});
