import { Image, StyleSheet, Text, View } from 'react-native';

import { currentTheme as theme } from '../constants/Colors';
import type { SavedMovie } from '../types/movie';

interface SavedMovieCardProps {
  movie: SavedMovie;
  width: number;
}

export function SavedMovieCard({ movie, width }: SavedMovieCardProps) {
  return (
    <View style={{ width }}>
      <Image
        accessibilityLabel={movie.title}
        source={{ uri: movie.posterUrl }}
        style={[styles.poster, { backgroundColor: theme.inputBg }]}
        resizeMode="cover"
      />
      <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{movie.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 10 },
  title: { fontSize: 12, fontWeight: '600', marginTop: 6, minHeight: 34 },
});
