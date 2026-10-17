import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import activityReducer from './activitySlice';
import userDomainReducer from './userDomainSlice';
import { initializeUserDomain } from '../services/userDomain';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    activity: activityReducer,
    userDomain: userDomainReducer,
    // İleride buraya movies: movieReducer falan da ekleyeceğiz
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    thunk: { extraArgument: { initializeUserDomain } },
  }),
});

// TypeScript için RootState ve AppDispatch tiplerini dışarı aktarıyoruz (Senior Dokunuşu ✨)
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
