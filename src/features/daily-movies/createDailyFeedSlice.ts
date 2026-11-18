import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { DailyMovieFeed } from '../../types/movie';
import { clearAuth, setAuth } from '../../store/authSlice.ts';

export interface DailySession { userId: string; sessionGeneration: number }
export interface DailyMoviesState<Feed = DailyMovieFeed> {
  userId: string | null;
  sessionGeneration: number;
  feed: Feed | null;
  requestId: string | null;
  hasError: boolean;
}

// Shared daily, legacy personal daily and weekly feeds share session/race
// protection, with separate state keys, actions and injected services.
export function createDailyFeedSlice<Name extends string, Services, Feed extends { userId: string } = DailyMovieFeed>(
  name: Name,
  fetchFeed: (services: Services, userId: string, signal: AbortSignal) => Promise<Feed>,
) {
  type State = { auth: { user: { id: string } | null; sessionGeneration: number } } & Record<Name, DailyMoviesState<Feed>>;
  const empty = (userId: string | null = null, sessionGeneration = 0): DailyMoviesState<Feed> => ({
    userId, sessionGeneration, feed: null, requestId: null, hasError: false,
  });
  const current = (state: State, session: DailySession): boolean => {
    const feed = state[name] as DailyMoviesState<Feed>;
    return state.auth.user?.id === session.userId && state.auth.sessionGeneration === session.sessionGeneration
      && feed.userId === session.userId && feed.sessionGeneration === session.sessionGeneration;
  };
  const load = createAsyncThunk<Feed, DailySession, { state: State; extra: Services }>(
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
          return { ...state, feed: action.payload, requestId: null, hasError: false };
        })
        .addCase(load.rejected, (state, action) => {
          if (state.requestId !== action.meta.requestId) return;
          state.requestId = null; state.hasError = !action.meta.aborted;
        });
    },
  });
  return { load, reducer: slice.reducer };
}
