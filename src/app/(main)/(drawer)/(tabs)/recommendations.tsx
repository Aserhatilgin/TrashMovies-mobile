import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { DailyMovieCarousel } from '../../../../components/DailyMovieCarousel';
import { DailyMovieStatus } from '../../../../components/DailyMovieStatus';
import { currentTheme as theme } from '../../../../constants/Colors';
import { currentLang as lang } from '../../../../constants/Translations';
import { PERSONAL_DAILY_MOVIES_V1_ENABLED } from '../../../../constants/Features';
import { usePersonalDailyMovies } from '../../../../hooks/usePersonalDailyMovies';
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
  // The focus-scoped hook requests an assignment only when this tab is opened.
  const { todayMovies, isLoading, hasError, today, todayStatus, reload } = usePersonalDailyMovies();
  return <View style={[styles.container, { backgroundColor: theme.background }]}>
    <DailyMovieStatus status={todayStatus} loading={isLoading} error={hasError} onRetry={() => { reload(); }} />
    {isLoading && !todayStatus ? <View style={styles.empty}>
      <ActivityIndicator accessibilityLabel={lang.home.loadingMovie} color={theme.primary} size="large" />
    </View> : todayMovies.length > 0 ? <DailyMovieCarousel
      key={today} dailyMovies={todayMovies} today={today} showControls={false} showSource
    /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { fontSize: 16, textAlign: 'center', padding: 24 },
});
