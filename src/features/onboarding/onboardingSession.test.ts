import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@supabase/supabase-js';
import authReducer, { setAuth, clearAuth } from '../../store/authSlice.ts';

function user(id: string): User {
  return { id, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' };
}

test('logout and immediate same-user login produce a new flow generation', () => {
  const signedIn = authReducer(undefined, setAuth(user('A')));
  const signedOut = authReducer(signedIn, clearAuth());
  const signedInAgain = authReducer(signedOut, setAuth(user('A')));
  assert.ok(signedInAgain.sessionGeneration > signedIn.sessionGeneration);
  assert.equal(signedInAgain.user?.id, 'A');
});

test('switching users changes generation, while same-user token refresh preserves the draft', () => {
  const first = authReducer(undefined, setAuth(user('A')));
  const refreshed = authReducer(first, setAuth(user('A')));
  assert.equal(refreshed.sessionGeneration, first.sessionGeneration);
  const switched = authReducer(refreshed, setAuth(user('B')));
  assert.ok(switched.sessionGeneration > refreshed.sessionGeneration);
});
