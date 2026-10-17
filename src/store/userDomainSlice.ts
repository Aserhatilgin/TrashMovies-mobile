import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { initializeUserDomain } from '../services/userDomain';
import { clearAuth, setAuth } from './authSlice';
import type { RootState } from './index';
import { emptyUserDomainState, userDomainStateForAuthChange } from './userDomainRouting';

export const initializeUserDomainForSession = createAsyncThunk(
  'userDomain/initialize',
  async (userId: string) => {
    const domain = await initializeUserDomain();
    if (domain.profile.id !== userId) throw new Error('User-domain identity mismatch.');
    return domain.onboarding.requiredCompleted;
  },
  {
    condition: (userId, { getState }) => {
      const state = getState() as RootState;
      const domain = state.userDomain;
      return state.auth.user?.id === userId
        && domain.userId === userId
        && (domain.status === 'idle' || domain.status === 'error');
    },
  },
);

const userDomainSlice = createSlice({
  name: 'userDomain',
  initialState: emptyUserDomainState(),
  reducers: {
    // Applied only from an identity-checked initializer response in the active flow.
    acceptCompletedUserDomain: (state, action: { payload: string }) => {
      if (state.userId !== action.payload) return;
      state.status = 'ready';
      state.requiredCompleted = true;
      state.activeRequestId = null;
    },
    prepareDomainRefresh: (state, action: { payload: string }) => {
      if (state.userId !== action.payload) return;
      state.status = 'idle';
      state.requiredCompleted = null;
      state.activeRequestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(setAuth, (state, action) => userDomainStateForAuthChange(state, action.payload.id))
      .addCase(clearAuth, (state) => userDomainStateForAuthChange(state, null))
      .addCase(initializeUserDomainForSession.pending, (state, action) => {
        if (state.userId !== action.meta.arg) return;
        state.status = 'loading';
        state.requiredCompleted = null;
        state.activeRequestId = action.meta.requestId;
      })
      .addCase(initializeUserDomainForSession.fulfilled, (state, action) => {
        if (state.userId !== action.meta.arg || state.activeRequestId !== action.meta.requestId) return;
        state.status = 'ready';
        state.requiredCompleted = action.payload;
        state.activeRequestId = null;
      })
      .addCase(initializeUserDomainForSession.rejected, (state, action) => {
        if (state.userId !== action.meta.arg || state.activeRequestId !== action.meta.requestId) return;
        state.status = 'error';
        state.requiredCompleted = null;
        state.activeRequestId = null;
      });
  },
});

export const { prepareDomainRefresh, acceptCompletedUserDomain } = userDomainSlice.actions;
export default userDomainSlice.reducer;
