import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { DailyMovieFeed } from '../../types/movie';
import { clearAuth, setAuth } from '../../store/authSlice.ts';

export interface DailySession { userId: string; sessionGeneration: number }
export interface DailyMoviesState {
  userId: string | null;
  sessionGeneration: number;
  feed: DailyMovieFeed | null;
  requestId: string | null;
  hasError: boolean;
}

// Shared and personal feeds use identical session/race protection, but have
// separate state keys, actions and injected services. Neither can replace the other.
export function createDailyFeedSlice<Name extends string, Services>(
  name: Name,
  fetchFeed: (services: Services, userId: string, signal: AbortSignal) => Promise<DailyMovieFeed>,
) {
  type State = { auth: { user: { id: string } | null; sessionGeneration: number } } & Record<Name, DailyMoviesState>;
  const empty = (userId: string | null = null, sessionGeneration = 0): DailyMoviesState => ({
    userId, sessionGeneration, feed: null, requestId: null, hasError: false,
  });
  const current = (state: State, session: DailySession): boolean => {
    const feed = state[name] as DailyMoviesState;
    return state.auth.user?.id === session.userId && state.auth.sessionGeneration === session.sessionGeneration
      && feed.userId === session.userId && feed.sessionGeneration === session.sessionGeneration;
  };
  const load = createAsyncThunk<DailyMovieFeed, DailySession, { state: State; extra: Services }>(
    name + '/load',
    async (session, { extra, getState, signal }) => {
      const feed = await fetchFeed(extra, session.userId, signal);
      if (!current(getState(), session) || feed.userId !== session.userId) throw new Error('Obsolete daily movie read.');
      return feed;
    },
    { condition: (session, { getState }) => current(getState(), session) },
  );
  const slice = createSlice({
    name, initialState: empty(), reducers: {},
    extraReducers: (builder) => {
      builder
        .addCase(setAuth, (state, action) => state.userId === action.payload.id
          ? state : empty(action.payload.id, state.sessionGeneration + 1))
        .addCase(clearAuth, (state) => empty(null, state.sessionGeneration + 1))
        .addCase(load.pending, (state, action) => {
          if (state.userId !== action.meta.arg.userId || state.sessionGeneration !== action.meta.arg.sessionGeneration) return;
          state.requestId = action.meta.requestId; state.hasError = false;
        })
        .addCase(load.fulfilled, (state, action) => {
          if (state.requestId !== action.meta.requestId || state.userId !== action.meta.arg.userId
            || state.sessionGeneration !== action.meta.arg.sessionGeneration) return;
          state.feed = action.payload; state.requestId = null; state.hasError = false;
        })
        .addCase(load.rejected, (state, action) => {
          if (state.requestId !== action.meta.requestId) return;
          state.requestId = null; state.hasError = !action.meta.aborted;
        });
    },
  });
  return { load, reducer: slice.reducer };
}
