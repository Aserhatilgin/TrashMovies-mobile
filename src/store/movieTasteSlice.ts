import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MovieTasteSnapshot, MovieTasteValues } from '../types/movieTaste';
import { sameTaste, tasteDraft, tastePayload } from '../features/movie-taste/model.ts';
import { onboardingErrorCode as errorCode } from '../features/onboarding/onboardingOperations.ts';
import { clearAuth, setAuth } from './authSlice.ts';

export interface MovieTasteServices {
  fetchMovieTaste: (signal?: AbortSignal) => Promise<MovieTasteSnapshot>;
  saveMovieTaste: (userId: string, revision: number, values: MovieTasteValues, signal?: AbortSignal) => Promise<MovieTasteSnapshot>;
}
export interface TasteSession { userId: string; sessionGeneration: number }
export interface MovieTasteState {
  userId: string | null;
  sessionGeneration: number;
  snapshot: MovieTasteSnapshot | null;
  loadRequestId: string | null;
  saveRequestId: string | null;
  loadError: boolean;
  saveError: 'conflict' | 'save' | null;
}
interface TasteState {
  auth: { user: { id: string } | null; sessionGeneration: number };
  movieTaste: MovieTasteState;
}
const empty = (userId: string | null = null, sessionGeneration = 0): MovieTasteState => ({
  userId, sessionGeneration, snapshot: null, loadRequestId: null, saveRequestId: null, loadError: false, saveError: null,
});
function current(state: TasteState, session: TasteSession): boolean {
  return state.auth.user?.id === session.userId && state.auth.sessionGeneration === session.sessionGeneration
    && state.movieTaste.userId === session.userId && state.movieTaste.sessionGeneration === session.sessionGeneration;
}
type ThunkConfig = { state: TasteState; extra: MovieTasteServices; rejectValue: 'conflict' | 'save' };

export const loadMovieTaste = createAsyncThunk<MovieTasteSnapshot, TasteSession, ThunkConfig>(
  'movieTaste/load',
  async (session, { extra, getState, signal }) => {
    const snapshot = await extra.fetchMovieTaste(signal);
    if (!current(getState(), session) || snapshot.userId !== session.userId) throw new Error('Obsolete taste read.');
    return snapshot;
  },
  { condition: (session, { getState }) => current(getState(), session) && !getState().movieTaste.saveRequestId },
);

export const persistMovieTaste = createAsyncThunk<MovieTasteSnapshot,
  TasteSession & { revision: number; preferences: MovieTasteValues }, ThunkConfig>(
  'movieTaste/save',
  async (request, { extra, getState, signal, rejectWithValue }) => {
    const assertCurrent = () => {
      if (signal.aborted || !current(getState(), request)) throw new Error('Obsolete taste save.');
    };
    try {
      const snapshot = await extra.saveMovieTaste(request.userId, request.revision, request.preferences, signal);
      assertCurrent();
      if (snapshot.userId !== request.userId) throw new Error('Taste identity mismatch.');
      return snapshot;
    } catch (error) {
      assertCurrent();
      if (errorCode(error) === '40001') return rejectWithValue('conflict');
      if (errorCode(error)) return rejectWithValue('save');
      // A transport failure may follow a committed write. Reconcile without
      // re-saving or overwriting the user's draft with an unrelated snapshot.
      try {
        const snapshot = await extra.fetchMovieTaste(signal);
        assertCurrent();
        if (snapshot.userId === request.userId && snapshot.revision >= request.revision
          && sameTaste(tastePayload(tasteDraft(snapshot)), request.preferences)) return snapshot;
        if (snapshot.userId === request.userId && snapshot.revision > request.revision) return rejectWithValue('conflict');
      } catch { assertCurrent(); }
      return rejectWithValue('save');
    }
  },
  { condition: (request, { getState }) => current(getState(), request) && !getState().movieTaste.saveRequestId },
);

const slice = createSlice({
  name: 'movieTaste', initialState: empty(), reducers: {
    clearTasteSaveError: (state, action: PayloadAction<TasteSession>) => {
      if (state.userId === action.payload.userId && state.sessionGeneration === action.payload.sessionGeneration) state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(setAuth, (state, action) => state.userId === action.payload.id
        ? state : empty(action.payload.id, state.sessionGeneration + 1))
      .addCase(clearAuth, (state) => empty(null, state.sessionGeneration + 1))
      .addCase(loadMovieTaste.pending, (state, action) => {
        if (state.userId !== action.meta.arg.userId || state.sessionGeneration !== action.meta.arg.sessionGeneration) return;
        state.loadRequestId = action.meta.requestId; state.loadError = false;
      })
      .addCase(loadMovieTaste.fulfilled, (state, action) => {
        if (state.loadRequestId !== action.meta.requestId || state.userId !== action.meta.arg.userId
          || state.sessionGeneration !== action.meta.arg.sessionGeneration) return;
        state.loadRequestId = null;
        if (!state.snapshot || action.payload.revision >= state.snapshot.revision) state.snapshot = action.payload;
      })
      .addCase(loadMovieTaste.rejected, (state, action) => {
        if (state.loadRequestId !== action.meta.requestId) return;
        state.loadRequestId = null; state.loadError = !action.meta.aborted;
      })
      .addCase(persistMovieTaste.pending, (state, action) => {
        if (state.userId !== action.meta.arg.userId || state.sessionGeneration !== action.meta.arg.sessionGeneration) return;
        state.saveRequestId = action.meta.requestId; state.saveError = null;
        state.loadRequestId = null; // Invalidate reads started before this save.
      })
      .addCase(persistMovieTaste.fulfilled, (state, action) => {
        if (state.saveRequestId !== action.meta.requestId || state.userId !== action.meta.arg.userId
          || state.sessionGeneration !== action.meta.arg.sessionGeneration) return;
        state.snapshot = action.payload; state.saveRequestId = null; state.saveError = null; state.loadError = false;
      })
      .addCase(persistMovieTaste.rejected, (state, action) => {
        if (state.saveRequestId !== action.meta.requestId) return;
        state.saveRequestId = null; state.saveError = action.meta.aborted ? null : action.payload ?? 'save';
      });
  },
});

// Recommendation consumers can key/invalidate their results by this generation.
export const selectTasteRevision = (state: { movieTaste: MovieTasteState }): number | null => state.movieTaste.snapshot?.revision ?? null;
export const { clearTasteSaveError } = slice.actions;
export default slice.reducer;
