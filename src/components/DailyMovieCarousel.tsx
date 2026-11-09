import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CarouselPaginationDots } from './CarouselPaginationDots';
import { MovieCard } from './MovieCard';
import { MovieInteractionControls } from './MovieInteractionControls';
import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import { useMovieInteractions } from '../hooks/useMovieInteractions';
import type { DailyMovie } from '../types/movie';

interface DailyMovieCarouselProps {
  dailyMovies: DailyMovie[];
  today?: string;
  showControls?: boolean;
  showSource?: boolean;
}

const CARD_GAP = 12;

function formatScheduledDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function DailyMovieCarousel({ dailyMovies, today, showControls = true, showSource = false }: DailyMovieCarouselProps) {
  const movieIds = useMemo(() => dailyMovies.map((item) => item.movie.id), [dailyMovies]);
  const interactions = useMovieInteractions(movieIds);
  const [ratingMovieId, setRatingMovieId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [carouselHeight, setCarouselHeight] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList<DailyMovie>>(null);
  const { width, height } = useWindowDimensions();
  const availableHeight = carouselHeight || height - 130;
  const cardWidth = Math.min(width - 64, 340, Math.max(120, (availableHeight - 128) * 2 / 3));
  const itemWidth = cardWidth + CARD_GAP;
  const currentIndex = Math.min(visibleIndex ?? dailyMovies.length - 1, dailyMovies.length - 1);
  const currentPosition = currentIndex + 1;

  const openRating = (movieId: string): void => {
    setRatingMovieId(movieId);
    setSelectedRating(interactions.interactionsByMovieId[movieId]?.rating ?? null);
  };

  const submitRating = async (): Promise<void> => {
    if (ratingMovieId === null || selectedRating === null) return;
    const saved = await interactions.saveRating(ratingMovieId, selectedRating);
    if (saved) setRatingMovieId(null);
  };

  if (dailyMovies.length === 0) return null;
  return (
      <View style={styles.carousel} onLayout={(event) => setCarouselHeight(event.nativeEvent.layout.height)}>
        <FlatList
          ref={listRef}
          style={styles.movieList}
          data={dailyMovies}
          horizontal
          scrollEnabled={dailyMovies.length > 1}
          keyExtractor={(item) => item.scheduledDate}
          renderItem={({ item }) => (
            <View style={{ width: itemWidth, paddingRight: CARD_GAP }}>
              <Text style={[styles.date, { color: theme.text }]}>{formatScheduledDate(item.scheduledDate)}</Text>
              {showSource && <Text style={[styles.source, { color: theme.mutedText }]}>
                {item.scheduledDate !== today ? lang.home.history
                  : item.source === 'personal' ? lang.home.personalPick : lang.home.sharedPick}
              </Text>}
              <MovieCard
                movie={item.movie}
                backActions={(
                  <MovieInteractionControls
                    interaction={interactions.interactionsByMovieId[item.movie.id]}
                    disabled={interactions.isLoading || interactions.hasError || interactions.pendingMovieIds.includes(item.movie.id)}
                    onToggleSaved={() => { void interactions.toggleSaved(item.movie.id); }}
                    onToggleWatched={() => { void interactions.toggleWatched(item.movie.id); }}
                    onRate={() => openRating(item.movie.id)}
                  />
                )}
              />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: (width - cardWidth) / 2, alignItems: 'center' }}
          getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
          initialScrollIndex={dailyMovies.length - 1}
          onScrollToIndexFailed={() => listRef.current?.scrollToEnd({ animated: false })}
          onScroll={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
            setVisibleIndex(Math.max(0, Math.min(index, dailyMovies.length - 1)));
          }}
          scrollEventThrottle={16}
          snapToInterval={itemWidth}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
        />
        {interactions.hasError && <Text style={[styles.interactionError, { color: theme.mutedText }]}>{lang.interactions.loadError}</Text>}
        {showControls && <View style={styles.carouselControls}>
          <View pointerEvents="none" style={styles.positionIndicator} accessibilityLabel={`${currentPosition} / ${dailyMovies.length}`}>
            <CarouselPaginationDots currentIndex={currentIndex} total={dailyMovies.length} />
            <Text style={[styles.positionText, { color: theme.mutedText }]}>{currentPosition} / {dailyMovies.length}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={lang.home.backToToday}
            onPress={() => {
              setVisibleIndex(dailyMovies.length - 1);
              listRef.current?.scrollToIndex({ index: dailyMovies.length - 1, animated: true });
            }}
            style={[styles.todayButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="arrow-forward" size={22} color={theme.text} />
          </Pressable>
        </View>}
        <Modal
          visible={ratingMovieId !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setRatingMovieId(null)}
        >
          <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{lang.interactions.yourRating}</Text>
              <View style={styles.ratingChoices}>
                {[0, 1].map((row) => (
                  <View key={row} style={styles.ratingRow}>
                    {Array.from({ length: 5 }, (_, column) => row * 5 + column + 1).map((rating) => (
                      <Pressable
                        key={rating}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selectedRating === rating }}
                        onPress={() => setSelectedRating(rating)}
                        style={[styles.ratingChoice, {
                          backgroundColor: selectedRating === rating ? theme.primary : theme.background,
                          borderColor: selectedRating === rating ? theme.primary : theme.inputBorder,
                        }]}
                      >
                        <Text style={[styles.ratingNumber, { color: theme.text }]}>{rating}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setRatingMovieId(null)} style={[styles.modalAction, { borderColor: theme.inputBorder }]}>
                  <Text style={{ color: theme.mutedText }}>{lang.interactions.cancel}</Text>
                </Pressable>
                <Pressable
                  disabled={selectedRating === null || (ratingMovieId !== null && interactions.pendingMovieIds.includes(ratingMovieId))}
                  onPress={() => { void submitRating(); }}
                  style={[styles.modalAction, styles.saveAction, { backgroundColor: theme.primary, opacity: selectedRating === null ? 0.5 : 1 }]}
                >
                  <Text style={[styles.saveActionText, { color: theme.text }]}>{lang.interactions.saveRating}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
  );
}

const styles = StyleSheet.create({
  carousel: { width: '100%', flex: 1 },
  movieList: { flex: 1 },
  date: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  source: { textAlign: 'center', marginBottom: 8 },
  interactionError: { textAlign: 'center', paddingHorizontal: 20 },
  carouselControls: { minHeight: 83, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  positionIndicator: { position: 'absolute', left: 72, right: 72, top: 12, bottom: 20, alignItems: 'center', justifyContent: 'center', gap: 6 },
  positionText: { fontSize: 12, fontWeight: '600' },
  todayButton: { padding: 14, borderRadius: 28 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 340, borderWidth: 1, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 22 },
  ratingChoices: { gap: 9 },
  ratingRow: { flexDirection: 'row', gap: 9 },
  ratingChoice: { flex: 1, height: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  ratingNumber: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalAction: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  saveAction: { borderWidth: 0 },
  saveActionText: { fontWeight: '700' },
});
