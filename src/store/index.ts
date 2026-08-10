import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // İleride buraya movies: movieReducer falan da ekleyeceğiz
  },
});

// TypeScript için RootState ve AppDispatch tiplerini dışarı aktarıyoruz (Senior Dokunuşu ✨)
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;