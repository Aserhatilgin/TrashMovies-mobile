import { StyleSheet, View } from 'react-native';
import { MovieCard } from '../../../components/MovieCard';
import { currentTheme as theme } from '../../../constants/Colors';
import { Movie } from '../../../types/movie';

const mockMovie: Movie = {
  id: 'birdemic-shock-and-terror',
  title: 'Birdemic: Shock and Terror',
  description:
    'A small town faces an unexplained attack by flocks of aggressive birds, forcing two unlikely heroes to fight for survival.',
  posterUrl: 'https://upload.wikimedia.org/wikipedia/en/9/96/Birdemicposter.jpg',
  imdbRating: 1.7,
};

export default function HomeScreen() {
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MovieCard movie={mockMovie} />
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
});
