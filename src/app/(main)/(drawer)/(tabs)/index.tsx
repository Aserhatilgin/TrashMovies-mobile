import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { DailyMovieCarousel } from '../../../../components/DailyMovieCarousel';
import { DailyMovieStatus } from '../../../../components/DailyMovieStatus';
import { currentTheme as theme } from '../../../../constants/Colors';
import { currentLang as lang } from '../../../../constants/Translations';
import { useDailyMovies } from '../../../../hooks/useDailyMovies';
import type { RootState } from '../../../../store';

export default function HomeScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const generation = useSelector((state: RootState) => state.auth.sessionGeneration);
  return <HomeContent key={`${userId}:${generation}`} />;
}

function HomeContent() {
  const { dailyMovies, isLoading, hasError, today, reload } = useDailyMovies();
  return <View style={[styles.container, { backgroundColor: theme.background }]}>
    <DailyMovieStatus loading={isLoading} error={hasError} onRetry={() => { reload(); }} />
    {isLoading && dailyMovies.length === 0 ? <View style={styles.empty}>
      <ActivityIndicator accessibilityLabel={lang.home.loadingMovie} color={theme.primary} size="large" />
    </View> : dailyMovies.length > 0 ? <DailyMovieCarousel dailyMovies={dailyMovies} today={today} />
      : !hasError ? <View style={styles.empty}>
        <Text style={[styles.message, { color: theme.mutedText }]}>{lang.home.noMovieAvailable}</Text>
      </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { fontSize: 16, textAlign: 'center', padding: 24 },
});
