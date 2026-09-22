import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDispatch, useSelector } from 'react-redux';

import { supabase } from '../lib/supabase';
import { store, type AppDispatch, type RootState } from '../store';
import { clearAuth, setAuth } from '../store/authSlice';

function InitialLayout() {
  const { isAuthenticated, isInitialized } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        dispatch(setAuth(session.user));
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
        dispatch(clearAuth());
      }
    });

    // initialize() reuses the client's bootstrap promise. Auth events provide
    // the session; this only resolves an unexpected bootstrap failure.
    void supabase.auth.initialize().then(({ error }) => {
      if (error && !store.getState().auth.isInitialized) dispatch(clearAuth());
    }).catch(() => {
      if (!store.getState().auth.isInitialized) dispatch(clearAuth());
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const syncRefresh = (active: boolean): void => {
      const operation = active
        ? supabase.auth.startAutoRefresh()
        : supabase.auth.stopAutoRefresh();
      void operation.catch(() => console.warn('Unable to update auth refresh state.'));
    };

    syncRefresh(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      syncRefresh(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={isInitialized && !isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isInitialized && isAuthenticated}>
        <Stack.Screen name="(main)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Provider store={store}>
        <InitialLayout />
      </Provider>
    </SafeAreaProvider>
  );
}
