import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import activityReducer from './activitySlice';
import userDomainReducer from './userDomainSlice';
import movieTasteReducer from './movieTasteSlice';
import { fetchMovieTaste, saveMovieTaste } from '../services/movieTaste';
import { initializeUserDomain } from '../services/userDomain';
import dailyMoviesReducer from './dailyMoviesSlice';
import { fetchDailyMovieFeed } from '../services/movies';
import sharedDailyMoviesReducer from './sharedDailyMoviesSlice';
import { fetchSharedDailyMovieFeed } from '../services/sharedDailyMovies';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    activity: activityReducer,
    userDomain: userDomainReducer,
    movieTaste: movieTasteReducer,
    dailyMovies: dailyMoviesReducer,
    sharedDailyMovies: sharedDailyMoviesReducer,
    // İleride buraya movies: movieReducer falan da ekleyeceğiz
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    thunk: { extraArgument: { initializeUserDomain, fetchMovieTaste, saveMovieTaste, fetchDailyMovieFeed, fetchSharedDailyMovieFeed } },
  }),
});

// TypeScript için RootState ve AppDispatch tiplerini dışarı aktarıyoruz (Senior Dokunuşu ✨)
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
