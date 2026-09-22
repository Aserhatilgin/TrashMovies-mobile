import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import { useActivitySummary } from '../hooks/useActivitySummary';

export function HomeStreakIndicator() {
  const { summary } = useActivitySummary();

  return (
    <View style={styles.container} accessibilityLabel={`${lang.streak.title}: ${summary?.currentStreak ?? 0}`}>
      <Ionicons name="flame" size={18} color={theme.primary} />
      <Text style={[styles.count, { color: theme.text }]}>{summary?.currentStreak ?? lang.streak.countPending}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 54 },
  count: { fontSize: 15, fontWeight: '700' },
});
