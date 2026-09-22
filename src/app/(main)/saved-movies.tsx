import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { SavedMovieCard } from '../../components/SavedMovieCard';
import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import { useSavedMovies } from '../../hooks/useSavedMovies';
import type { SavedMovie } from '../../types/movie';

const HORIZONTAL_PADDING = 20;
const GRID_GAP = 12;

export default function SavedMoviesScreen() {
  const { width } = useWindowDimensions();
  const itemWidth = (width - HORIZONTAL_PADDING * 2 - GRID_GAP * 2) / 3;
  const saved = useSavedMovies(30);

  if (saved.isLoading && saved.movies.length === 0) {
    return (
      <View style={[styles.status, { backgroundColor: theme.background }]}>
        <ActivityIndicator accessibilityLabel={lang.profile.loadingSaved} color={theme.primary} />
      </View>
    );
  }

  if (saved.hasError && saved.movies.length === 0) {
    return (
      <View style={[styles.status, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.mutedText }}>{lang.profile.savedError}</Text>
      </View>
    );
  }

  return (
    <FlatList<SavedMovie>
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.grid}
      data={saved.movies}
      numColumns={3}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <SavedMovieCard movie={item} width={itemWidth} />
        </View>
      )}
      onEndReached={() => { void saved.loadMore(); }}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={<Text style={[styles.empty, { color: theme.mutedText }]}>{lang.profile.savedEmpty}</Text>}
      ListFooterComponent={saved.isLoadingMore
        ? <ActivityIndicator style={styles.footer} color={theme.primary} />
        : saved.hasError ? <Text style={[styles.footer, { color: theme.mutedText }]}>{lang.profile.savedError}</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  status: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  grid: { paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 20, paddingBottom: 36, flexGrow: 1 },
  row: { gap: GRID_GAP },
  item: { marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 24 },
  footer: { textAlign: 'center', marginVertical: 16 },
});
