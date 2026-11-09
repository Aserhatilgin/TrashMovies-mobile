import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import type { DailyMovieFeedStatus } from '../types/movie';

export function DailyMovieStatus({ status, loading, error, onRetry }: {
  status?: DailyMovieFeedStatus; loading: boolean; error: boolean; onRetry: () => void;
}) {
  const message = error ? lang.home.loadMovieError
    : status === 'no_candidate' ? lang.home.noPersonalCandidate
      : status === 'no_shared_movie' ? lang.home.noSharedMovie : null;
  if (!message) return null;
  return <View style={styles.container}>
    <Text accessibilityRole="alert" style={[styles.text, { color: theme.text }]}>{message}</Text>
    <Pressable accessibilityRole="button" disabled={loading} onPress={onRetry} style={styles.retry}>
      {loading ? <ActivityIndicator color={theme.primary} accessibilityLabel={lang.home.loadingMovie} />
        : <Text style={{ color: theme.primary }}>{lang.home.retry}</Text>}
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', gap: 8 },
  text: { textAlign: 'center', fontSize: 16 }, retry: { minHeight: 44, minWidth: 100, alignItems: 'center', justifyContent: 'center' },
});
