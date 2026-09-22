import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';
import type { MovieInteraction } from '../types/movieInteraction';

interface MovieInteractionControlsProps {
  interaction: MovieInteraction | undefined;
  disabled: boolean;
  onToggleSaved: () => void;
  onToggleWatched: () => void;
  onRate: () => void;
}

export function MovieInteractionControls({
  interaction, disabled, onToggleSaved, onToggleWatched, onRate,
}: MovieInteractionControlsProps) {
  const saved = interaction?.savedAt != null;
  const watched = interaction?.watchedAt != null;
  const rating = interaction?.rating;

  return (
    <View style={[styles.actions, { borderTopColor: theme.inputBorder }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? lang.interactions.saved : lang.interactions.save}
        accessibilityState={{ disabled, selected: saved }}
        disabled={disabled}
        onPress={(event) => { event.stopPropagation(); onToggleSaved(); }}
        style={[styles.action, { opacity: disabled ? 0.45 : 1 }]}
      >
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? theme.primary : theme.text} />
        <Text numberOfLines={1} style={[styles.label, { color: saved ? theme.primary : theme.text }]}>
          {saved ? lang.interactions.saved : lang.interactions.save}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={watched ? lang.interactions.watched : lang.interactions.markWatched}
        accessibilityState={{ disabled, selected: watched }}
        disabled={disabled}
        onPress={(event) => { event.stopPropagation(); onToggleWatched(); }}
        style={[styles.action, { opacity: disabled ? 0.45 : 1 }]}
      >
        <Ionicons name={watched ? 'checkmark-circle' : 'checkmark-circle-outline'} size={20} color={watched ? theme.primary : theme.text} />
        <Text numberOfLines={1} style={[styles.label, { color: watched ? theme.primary : theme.text }]}>
          {watched ? lang.interactions.watched : lang.interactions.markWatched}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rating != null ? `${lang.interactions.yourRating}: ${rating}` : lang.interactions.rate}
        accessibilityHint={!watched ? lang.interactions.watchBeforeRating : undefined}
        accessibilityState={{ disabled: disabled || !watched }}
        disabled={disabled || !watched}
        onPress={(event) => { event.stopPropagation(); onRate(); }}
        style={[styles.action, { opacity: disabled || !watched ? 0.45 : 1 }]}
      >
        <Ionicons name={rating != null ? 'star' : 'star-outline'} size={20} color={rating != null ? theme.primary : theme.text} />
        <Text numberOfLines={1} style={[styles.label, { color: rating != null ? theme.primary : theme.text }]}>
          {rating ?? lang.interactions.rate}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
