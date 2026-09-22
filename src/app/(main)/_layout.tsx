import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';

import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import { useDailyActivityRecorder } from '../../hooks/useDailyActivityRecorder';
import type { RootState } from '../../store';

export default function MainStackLayout() {
  const userId = useSelector((state: RootState) => state.auth.user?.id ?? null);
  useDailyActivityRecorder(userId);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(drawer)" />
      <Stack.Screen
        name="saved-movies"
        options={{
          headerShown: true,
          title: lang.profile.savedMovies,
          headerLeft: () => (
            <Pressable
              accessibilityLabel={lang.profile.closeSavedMovies}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={styles.closeButton}
            >
              <Ionicons name="arrow-down" size={24} color={theme.text} />
            </Pressable>
          ),
          animation: 'slide_from_bottom',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
      <Stack.Screen
        name="daily-games"
        options={{
          headerShown: true,
          title: lang.game.dailyTitle,
          headerBackButtonDisplayMode: 'minimal',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
