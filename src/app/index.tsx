import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import type { AppDispatch, RootState } from '../store';
import { selectAppRoute } from '../store/userDomainRouting';
import { initializeUserDomainForSession } from '../store/userDomainSlice';

export default function Index() {
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id ?? null);
  const sessionGeneration = useSelector((state: RootState) => state.auth.sessionGeneration);
  const route = useSelector(selectAppRoute);

  if (route === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator
          accessibilityLabel={userId ? lang.onboarding.initializing : lang.auth.initializing}
          color={theme.primary}
        />
      </View>
    );
  }

  if (route === 'error') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>{lang.onboarding.bootstrapError}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => { if (userId) void dispatch(initializeUserDomainForSession({ userId, sessionGeneration })); }}
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.retryText, { color: theme.text }]}>{lang.onboarding.retry}</Text>
        </Pressable>
      </View>
    );
  }

  if (route === 'auth') return <Redirect href="/(auth)/login" />;
  if (route === 'onboarding') return <Redirect href="/(onboarding)" />;
  return <Redirect href="/(main)/(drawer)/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  errorText: { fontSize: 16, textAlign: 'center' },
  retryButton: { minHeight: 48, minWidth: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  retryText: { fontSize: 16, fontWeight: '700' },
});
