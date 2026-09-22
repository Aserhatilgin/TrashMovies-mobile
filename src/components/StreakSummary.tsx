import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import type { ActivitySummary } from '../services/activity';
import { ProfileCard } from './ProfileCard';

interface StreakSummaryProps {
  summary: ActivitySummary | null;
  isLoading: boolean;
}

export function StreakSummary({ summary, isLoading }: StreakSummaryProps) {

  return (
    <ProfileCard style={styles.container}>
      <Text style={[styles.title, { color: theme.mutedText }]}>{lang.streak.title}</Text>
      {isLoading ? (
        <ActivityIndicator color={theme.primary} />
      ) : !summary ? (
        <Text style={{ color: theme.mutedText }}>{lang.streak.loadError}</Text>
      ) : (
        <>
          <Text style={[styles.count, { color: theme.text }]}>🔥 {summary.currentStreak} {lang.streak.days}</Text>
          <View style={styles.days}>
            {summary.lastSevenDays.map((day) => (
              <View key={day.date} style={styles.day}>
                <Text style={[styles.weekday, { color: theme.mutedText }]}>{lang.streak.weekdays[day.weekday]}</Text>
                <Ionicons
                  name={day.hasActivity ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={day.hasActivity ? theme.primary : theme.mutedText}
                  accessibilityLabel={day.date}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 82, paddingHorizontal: 14, paddingVertical: 9 },
  title: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  count: { fontSize: 16, fontWeight: '700', marginBottom: 5 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 2, minWidth: 24 },
  weekday: { fontSize: 10 },
});
