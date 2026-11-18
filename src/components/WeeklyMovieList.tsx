import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MovieCard } from './MovieCard';
import { MovieInteractionControls } from './MovieInteractionControls';
import { MovieRatingModal } from './MovieRatingModal';
import { useMovieInteractions } from '../hooks/useMovieInteractions';
import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import type { WeeklyMovie } from '../types/weeklyMovies';

export function WeeklyMovieList({ items }: { items: WeeklyMovie[] }) {
  const ids = useMemo(() => items.map((item) => item.movie.id), [items]);
  const interactions = useMovieInteractions(ids);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const openRating = (id: string) => { setRatingId(id); setRating(interactions.interactionsByMovieId[id]?.rating ?? null); };
  const saveRating = async () => {
    if (ratingId === null || rating === null) return;
    if (await interactions.saveRating(ratingId, rating)) setRatingId(null);
  };
  return <>
    <FlatList data={items} keyExtractor={(item) => item.movie.id} contentContainerStyle={styles.list}
      renderItem={({ item }) => <View style={{ width: Math.min(width - 40, 340) }}>
        <MovieCard movie={item.movie} backActions={<MovieInteractionControls
          interaction={interactions.interactionsByMovieId[item.movie.id]}
          disabled={interactions.isLoading || interactions.hasError || interactions.pendingMovieIds.includes(item.movie.id)}
          onToggleSaved={() => { void interactions.toggleSaved(item.movie.id); }}
          onToggleWatched={() => { void interactions.toggleWatched(item.movie.id); }} onRate={() => openRating(item.movie.id)}
        />} />
      </View>}
      ListFooterComponent={interactions.hasError ? <Text style={{ color: theme.mutedText }}>{lang.interactions.loadError}</Text> : null}
    />
    <MovieRatingModal visible={ratingId !== null} selectedRating={rating}
      saving={ratingId !== null && interactions.pendingMovieIds.includes(ratingId)} onSelect={setRating}
      onClose={() => setRatingId(null)} onSave={() => { void saveRating(); }} />
  </>;
}
const styles = StyleSheet.create({ list: { alignItems: 'center', paddingTop: 8, paddingBottom: 24, gap: 24 } });
