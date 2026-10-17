import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emptyUserDomainState,
  resolveAppRoute,
  userDomainStateForAuthChange,
} from '../../src/store/userDomainRouting.ts';

const authenticated = { isInitialized: true, userId: 'user-a' };

test('no session routes to auth', () => {
  assert.equal(resolveAppRoute({ isInitialized: true, userId: null }, emptyUserDomainState()), 'auth');
});

test('a completed required version routes to Main', () => {
  assert.equal(resolveAppRoute(authenticated, {
    userId: 'user-a', status: 'ready', requiredCompleted: true, activeRequestId: null,
  }), 'main');
});

test('an incomplete required version routes to onboarding', () => {
  assert.equal(resolveAppRoute(authenticated, {
    userId: 'user-a', status: 'ready', requiredCompleted: false, activeRequestId: null,
  }), 'onboarding');
});

test('session and domain loading show neither Main nor onboarding', () => {
  assert.equal(resolveAppRoute({ isInitialized: false, userId: null }, emptyUserDomainState()), 'loading');
  assert.equal(resolveAppRoute(authenticated, emptyUserDomainState('user-a')), 'loading');
  assert.equal(resolveAppRoute(authenticated, {
    userId: 'user-a', status: 'loading', requiredCompleted: null, activeRequestId: 'request',
  }), 'loading');
});

test('RPC failure remains a retryable error', () => {
  assert.equal(resolveAppRoute(authenticated, {
    userId: 'user-a', status: 'error', requiredCompleted: null, activeRequestId: null,
  }), 'error');
});

test('logout and user switching clear prior routing state', () => {
  const prior = {
    userId: 'user-a', status: 'ready', requiredCompleted: true, activeRequestId: null,
  };
  const loggedOut = userDomainStateForAuthChange(prior, null);
  assert.deepEqual(loggedOut, emptyUserDomainState());
  assert.equal(resolveAppRoute({ isInitialized: true, userId: null }, loggedOut), 'auth');

  const nextUser = userDomainStateForAuthChange(prior, 'user-b');
  assert.deepEqual(nextUser, emptyUserDomainState('user-b'));
  assert.equal(resolveAppRoute({ isInitialized: true, userId: 'user-b' }, nextUser), 'loading');
  assert.equal(resolveAppRoute(authenticated, nextUser), 'loading');
});
