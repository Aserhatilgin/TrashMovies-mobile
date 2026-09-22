import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';

import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import type { RootState } from '../store';

export default function Index() {
  const { isInitialized, isAuthenticated } = useSelector((state: RootState) => state.auth);

  if (!isInitialized) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator accessibilityLabel={lang.auth.initializing} color={theme.primary} />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(main)/(drawer)/(tabs)' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
