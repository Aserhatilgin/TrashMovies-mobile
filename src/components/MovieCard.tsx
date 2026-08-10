import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import { Movie } from '../types/movie';

interface MovieCardProps {
  movie: Movie;
}

const FLIP_DURATION_MS = 500;

export function MovieCard({ movie }: MovieCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipProgress = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    const nextIsFlipped = !isFlipped;

    setIsFlipped(nextIsFlipped);
    Animated.timing(flipProgress, {
      toValue: nextIsFlipped ? 1 : 0,
      duration: FLIP_DURATION_MS,
      useNativeDriver: true,
    }).start();
  };

  const frontRotation = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotation = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipProgress.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipProgress.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const accessibilityAction = isFlipped
    ? lang.movieCard.showPoster
    : lang.movieCard.showDetails;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}. ${accessibilityAction}`}
      accessibilityHint={lang.movieCard.flipHint}
      onPress={handlePress}
      style={styles.pressable}
    >
      <View style={styles.cardContainer}>
        <Animated.View
          pointerEvents={isFlipped ? 'none' : 'auto'}
          style={[
            styles.cardFace,
            styles.frontFace,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              opacity: frontOpacity,
              transform: [{ perspective: 1000 }, { rotateY: frontRotation }],
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: movie.posterUrl }}
            resizeMode="cover"
            style={styles.poster}
          />
          <View style={styles.titleContainer}>
            <Text numberOfLines={2} style={[styles.frontTitle, { color: theme.text }]}>
              {movie.title}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={isFlipped ? 'auto' : 'none'}
          style={[
            styles.cardFace,
            styles.backFace,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              opacity: backOpacity,
              transform: [{ perspective: 1000 }, { rotateY: backRotation }],
            },
          ]}
        >
          <Text style={[styles.backTitle, { color: theme.text }]}>{movie.title}</Text>
          <Text style={[styles.description, { color: theme.mutedText }]}>
            {movie.description}
          </Text>
          <View style={[styles.rating, { backgroundColor: theme.primary }]}>
            <Text style={[styles.ratingText, { color: theme.text }]}>
              {lang.movieCard.imdbRating}: {movie.imdbRating.toFixed(1)}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
    maxWidth: 340,
  },
  cardContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  frontFace: {
    justifyContent: 'flex-end',
  },
  backFace: {
    justifyContent: 'center',
    padding: 24,
  },
  poster: {
    flex: 1,
    width: '100%',
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  frontTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  backTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  rating: {
    alignSelf: 'center',
    borderRadius: 12,
    marginTop: 28,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
