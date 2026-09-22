import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { fetchActivitySummary, type ActivityDay } from '../services/activity';
import { clearAuth, setAuth } from './authSlice';
import type { RootState } from './index';

interface ActivityState {
  userId: string | null;
  currentStreak: number | null;
  totalActiveDays: number | null;
  lastSevenDays: ActivityDay[] | null;
  isInitialized: boolean;
  isRefreshing: boolean;
  error: string | null;
  activeRequestId: string | null;
}

const initialState: ActivityState = {
  userId: null,
  currentStreak: null,
  totalActiveDays: null,
  lastSevenDays: null,
  isInitialized: false,
  isRefreshing: false,
  error: null,
  activeRequestId: null,
};

export const refreshActivitySummary = createAsyncThunk(
  'activity/refreshSummary',
  (userId: string) => fetchActivitySummary(userId),
  {
    condition: (userId, { getState }) => {
      const activity = (getState() as RootState).activity;
      return activity.userId === userId && !activity.isRefreshing;
    },
  },
);

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(setAuth, (state, action) => {
        const userId = action.payload.id;
        if (state.userId !== userId) return { ...initialState, userId };
      })
      .addCase(clearAuth, () => initialState)
      .addCase(refreshActivitySummary.pending, (state, action) => {
        if (state.userId !== action.meta.arg) return;
        state.isRefreshing = true;
        state.error = null;
        state.activeRequestId = action.meta.requestId;
      })
      .addCase(refreshActivitySummary.fulfilled, (state, action) => {
        if (state.userId !== action.meta.arg || state.activeRequestId !== action.meta.requestId) return;
        state.currentStreak = action.payload.currentStreak;
        state.totalActiveDays = action.payload.totalActiveDays;
        state.lastSevenDays = action.payload.lastSevenDays;
        state.isInitialized = true;
        state.isRefreshing = false;
        state.activeRequestId = null;
      })
      .addCase(refreshActivitySummary.rejected, (state, action) => {
        if (state.userId !== action.meta.arg || state.activeRequestId !== action.meta.requestId) return;
        state.isInitialized = true;
        state.isRefreshing = false;
        state.activeRequestId = null;
        state.error = 'Unable to load activity summary.';
      });
  },
});

export default activitySlice.reducer;
