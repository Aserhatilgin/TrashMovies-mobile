import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MovieCard } from '../../../components/MovieCard';
import { currentTheme as theme } from '../../../constants/Colors';
import { currentLang as lang } from '../../../constants/Translations';
import { useFeaturedMovie } from '../../../hooks/useFeaturedMovie';

export default function HomeScreen() {
  const { movie, isLoading, hasError } = useFeaturedMovie();

  let content;
  if (isLoading) {
    content = (
      <ActivityIndicator
        accessibilityLabel={lang.home.loadingMovie}
        color={theme.primary}
        size="large"
      />
    );
  } else if (hasError) {
    content = (
      <Text style={[styles.statusText, { color: theme.text }]}>
        {lang.home.loadMovieError}
      </Text>
    );
  } else if (movie === null) {
    content = (
      <Text style={[styles.statusText, { color: theme.mutedText }]}>
        {lang.home.noMovieAvailable}
      </Text>
    );
  } else {
    content = <MovieCard movie={movie} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
