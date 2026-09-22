import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MovieCard } from '../../../components/MovieCard';
import { currentTheme as theme } from '../../../constants/Colors';
import { currentLang as lang } from '../../../constants/Translations';
import { useDailyMovies } from '../../../hooks/useDailyMovies';
import type { DailyMovie } from '../../../types/movie';

const CARD_GAP = 12;

function formatScheduledDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function HomeScreen() {
  const { dailyMovies, isLoading, hasError } = useDailyMovies();
  const listRef = useRef<FlatList<DailyMovie>>(null);
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 64, 340, (height - 280) * 2 / 3);
  const itemWidth = cardWidth + CARD_GAP;

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
  } else if (dailyMovies.length === 0) {
    content = (
      <Text style={[styles.statusText, { color: theme.mutedText }]}>
        {lang.home.noMovieAvailable}
      </Text>
    );
  } else {
    content = (
      <View style={styles.carousel}>
        <FlatList
          ref={listRef}
          data={dailyMovies}
          horizontal
          keyExtractor={(item) => item.scheduledDate}
          renderItem={({ item }) => (
            <View style={{ width: itemWidth, paddingRight: CARD_GAP }}>
              <Text style={[styles.date, { color: theme.text }]}>{formatScheduledDate(item.scheduledDate)}</Text>
              <MovieCard movie={item.movie} />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: (width - cardWidth) / 2, alignItems: 'center' }}
          getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
          initialScrollIndex={dailyMovies.length - 1}
          onScrollToIndexFailed={() => listRef.current?.scrollToEnd({ animated: false })}
          snapToInterval={itemWidth}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
        />
        <View style={styles.carouselControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={lang.home.backToToday}
            onPress={() => listRef.current?.scrollToIndex({ index: dailyMovies.length - 1, animated: true })}
            style={[styles.todayButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="arrow-forward" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>
    );
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
  },
  carousel: { width: '100%', flex: 1, justifyContent: 'center' },
  date: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  carouselControls: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  todayButton: { padding: 14, borderRadius: 28 },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
  },
});
