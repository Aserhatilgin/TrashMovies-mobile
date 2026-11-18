import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { WeeklyMovieList } from '../../../../components/WeeklyMovieList';
import { currentTheme as theme } from '../../../../constants/Colors';
import { currentLang as lang } from '../../../../constants/Translations';
import { PERSONAL_DAILY_MOVIES_V1_ENABLED } from '../../../../constants/Features';
import { useWeeklyMovies } from '../../../../hooks/useWeeklyMovies';
import type { RootState } from '../../../../store';

export default function RecommendationsScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const generation = useSelector((state: RootState) => state.auth.sessionGeneration);
  if (!PERSONAL_DAILY_MOVIES_V1_ENABLED) {
    return <View style={[styles.empty, { backgroundColor: theme.background }]}>
      <Text style={[styles.message, { color: theme.mutedText }]}>{lang.recommendations.unavailable}</Text>
    </View>;
  }
  return <RecommendationContent key={`${userId}:${generation}`} />;
}

function RecommendationContent() {
  const { collection, isLoading, hasError, reload } = useWeeklyMovies();
  const formatDate = (date: string) => new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(date + 'T00:00:00Z'));
  return <View style={[styles.container, { backgroundColor: theme.background }]}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{lang.recommendations.weeklyTitle}</Text>
      {collection ? <>
        <Text style={{ color: theme.mutedText }}>{formatDate(collection.weekStart)} – {formatDate(collection.weekEnd)}</Text>
        <Text style={{ color: theme.mutedText }}>{lang.recommendations.weeklyCount.replace('{count}', String(collection.items.length))}</Text>
      </> : null}
    </View>
    {hasError ? <View style={styles.heading}>
      <Text accessibilityRole="alert" style={{ color: theme.text }}>{lang.recommendations.weeklyError}</Text>
      <Pressable accessibilityRole="button" disabled={isLoading} onPress={() => { reload(); }} style={styles.retry}>
        <Text style={{ color: theme.primary }}>{lang.home.retry}</Text>
      </Pressable>
    </View> : null}
    {isLoading && !collection ? <View style={styles.empty}>
      <ActivityIndicator accessibilityLabel={lang.recommendations.weeklyLoading} color={theme.primary} size="large" />
    </View> : collection?.items.length ? <WeeklyMovieList key={collection.weekStart} items={collection.items} />
      : collection?.status === 'empty' ? <View style={styles.empty}>
        <Text style={[styles.message, { color: theme.mutedText }]}>{lang.recommendations.weeklyEmpty}</Text>
      </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { fontSize: 16, textAlign: 'center', padding: 24 },
  heading: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  title: { fontSize: 23, fontWeight: '700' }, retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
});
