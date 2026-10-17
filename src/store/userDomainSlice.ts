import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { initializeUserDomain, UserDomainBootstrap } from '../services/userDomain';
import { clearAuth, setAuth } from './authSlice.ts';
import { emptyUserDomainState, userDomainStateForAuthChange, type UserDomainRouteState } from './userDomainRouting.ts';

interface UserDomainRequest {
  userId: string;
  sessionGeneration: number;
  // Revalidate ready state without removing the current screen while awaiting it.
  refresh?: boolean;
}

export interface UserDomainServices {
  initializeUserDomain: typeof initializeUserDomain;
}

interface UserDomainThunkState {
  auth: { user: { id: string } | null; sessionGeneration: number };
  userDomain: UserDomainRouteState;
}

export const initializeUserDomainForSession = createAsyncThunk<
  UserDomainBootstrap, UserDomainRequest, { state: UserDomainThunkState; extra: UserDomainServices }
>(
  'userDomain/initialize',
  async ({ userId, sessionGeneration }, { extra, getState, requestId, signal }) => {
    const domain = await extra.initializeUserDomain(signal);
    const state = getState();
    if (state.auth.user?.id !== userId || state.auth.sessionGeneration !== sessionGeneration
      || state.userDomain.activeRequestId !== requestId) {
      throw new Error('User-domain session changed during refresh.');
    }
    if (domain.profile.id !== userId) throw new Error('User-domain identity mismatch.');
    return domain;
  },
  {
    condition: ({ userId, sessionGeneration, refresh }, { getState }) => {
      const state = getState();
      const domain = state.userDomain;
      return state.auth.user?.id === userId
        && state.auth.sessionGeneration === sessionGeneration
        && domain.userId === userId
        && (refresh || domain.status === 'idle' || domain.status === 'error');
    },
  },
);

const userDomainSlice = createSlice({
  name: 'userDomain',
  initialState: emptyUserDomainState(),
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(setAuth, (state, action) => userDomainStateForAuthChange(state, action.payload.id))
      .addCase(clearAuth, (state) => userDomainStateForAuthChange(state, null))
      .addCase(initializeUserDomainForSession.pending, (state, action) => {
        if (state.userId !== action.meta.arg.userId) return;
        if (!action.meta.arg.refresh || state.status !== 'ready') {
          state.status = 'loading';
          state.requiredCompleted = null;
        }
        state.activeRequestId = action.meta.requestId;
      })
      .addCase(initializeUserDomainForSession.fulfilled, (state, action) => {
        if (state.userId !== action.meta.arg.userId || state.activeRequestId !== action.meta.requestId) return;
        state.status = 'ready';
        state.requiredCompleted = action.payload.onboarding.requiredCompleted;
        state.activeRequestId = null;
      })
      .addCase(initializeUserDomainForSession.rejected, (state, action) => {
        if (state.userId !== action.meta.arg.userId || state.activeRequestId !== action.meta.requestId) return;
        if (!action.meta.arg.refresh || state.status !== 'ready') {
          state.status = 'error';
          state.requiredCompleted = null;
        }
        state.activeRequestId = null;
      });
  },
});

export default userDomainSlice.reducer;
