import { useEffect, useState } from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { supabase } from '../lib/supabase'; // supabase.ts yolun
import { setAuth, clearAuth } from '../store/authSlice';
import { RootState, store } from '../store';

// 🧠 Redux ve Yönlendirme (Router) işlemlerini yapabilmek için
// Provider'ın İÇİNDE olan yeni bir bileşen oluşturduk.
function InitialLayout() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const segments = useSegments();
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        dispatch(setAuth({ session, user: session.user }));
      } else {
        dispatch(clearAuth());
      }

      setIsSessionLoaded(true);
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        dispatch(setAuth({ session, user: session.user }));
      } else {
        dispatch(clearAuth());
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [dispatch]);

  const inAuthGroup = segments[0] === '(auth)';
  const inMainGroup = segments[0] === '(main)';

  if (!isSessionLoaded) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
      </Stack>
    );
  }

  if (isAuthenticated && inAuthGroup) {
    return <Redirect href="/(main)/(drawer)/(tabs)" />;
  }

  if (!isAuthenticated && inMainGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
    </Stack>
  );
}

// Uygulamanın En Dış Katmanı
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* Redux Beynini Uygulamaya Bağlıyoruz */}
      <Provider store={store}>
        <InitialLayout />
      </Provider>
    </SafeAreaProvider>
  );
}