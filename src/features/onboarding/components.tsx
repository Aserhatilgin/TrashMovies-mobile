import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Image, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import type { OnboardingMovie, OnboardingGenre } from '../../services/onboarding';

interface ShellProps {
  stepKey: string;
  title: string;
  subtitle?: string;
  progress: string;
  progressFraction: number;
  children: ReactNode;
  onBack?: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  continueLabel?: string;
  canContinue: boolean;
  busy: boolean;
  error?: string | null;
  onReload?: () => void;
}

export function OnboardingShell(props: ShellProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    opacity.setValue(0);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [opacity, props.stepKey]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={lang.onboarding.back}
            disabled={!props.onBack || props.busy} onPress={props.onBack} style={styles.back}>
            <Ionicons name="arrow-back" size={23} color={props.onBack ? theme.text : theme.mutedText} />
          </Pressable>
          <Text style={[styles.progress, { color: theme.mutedText }]}>{props.progress}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.inputBorder }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.primary,
            width: (Math.round(props.progressFraction * 100) + '%') as `${number}%` }]} />
        </View>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" pointerEvents={props.busy ? 'none' : 'auto'} contentContainerStyle={styles.scroll}>
          <Animated.View style={[styles.body, { opacity }]}>
            <Text style={[styles.title, { color: theme.text }]}>{props.title}</Text>
            {props.subtitle ? <Text style={[styles.subtitle, { color: theme.mutedText }]}>{props.subtitle}</Text> : null}
            {props.children}
          </Animated.View>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: theme.inputBorder, backgroundColor: theme.background }]}>
          {props.error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.primary }]}>{props.error}</Text> : null}
          {props.onReload ? (
            <Pressable accessibilityRole="button" onPress={props.onReload} disabled={props.busy}>
              <Text style={[styles.reload, { color: theme.text }]}>{lang.onboarding.loadServerDraft}</Text>
            </Pressable>
          ) : null}
          <View style={styles.footerRow}>
            {props.onSkip ? (
              <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onSkip} style={styles.skip}>
                <Text style={[styles.skipText, { color: theme.mutedText }]}>{props.skipLabel ?? lang.onboarding.skip}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" disabled={!props.canContinue || props.busy}
              onPress={props.onContinue}
              style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: props.canContinue && !props.busy ? 1 : 0.45 }]}>
              {props.busy ? <ActivityIndicator color={theme.text} /> : (
                <Text style={[styles.primaryText, { color: theme.text }]}>{props.continueLabel ?? lang.onboarding.continue}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function ChoiceChip({ label, selected, onPress, disabled }: ChipProps) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.inputBg,
        borderColor: selected ? theme.primary : theme.inputBorder, opacity: disabled ? 0.4 : 1 }]}>
      {selected ? <Ionicons name="checkmark" size={16} color={theme.text} /> : null}
      <Text style={[styles.chipText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

export function ResultTag({ label }: { label: string }) {
  return <View style={[styles.chip, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
    <Text style={[styles.chipText, { color: theme.text }]}>{label}</Text>
  </View>;
}

export function ScaleSelector({ value, onSelect, labels, allowClear = false }: {
  value?: number;
  onSelect: (value: number | undefined) => void;
  labels: readonly string[];
  allowClear?: boolean;
}) {
  return (
    <View style={styles.scaleList}>
      {labels.map((label, index) => {
        const selected = value === index + 1;
        return (
          <Pressable key={index} accessibilityRole="radio" accessibilityLabel={`${index + 1}. ${label}`}
            accessibilityState={{ selected }} onPress={() => onSelect(selected && allowClear ? undefined : index + 1)}
            style={[styles.scaleCard, { backgroundColor: selected ? theme.primary : theme.inputBg,
              borderColor: selected ? theme.primary : theme.inputBorder }]}>
            <Text style={[styles.scaleNumber, { color: theme.text }]}>{index + 1}</Text>
            <Text style={[styles.scaleLabel, { color: theme.text }]}>{label}</Text>
            {selected ? <Ionicons name="checkmark-circle" size={21} color={theme.text} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function GenreChoices({ genres, selected, disabledIds, max, onToggle }: {
  genres: readonly OnboardingGenre[];
  selected: readonly string[];
  disabledIds?: readonly string[];
  max: number;
  onToggle: (id: string) => void;
}) {
  return (
    <ChipGroup>
      {genres.map((genre) => (
        <ChoiceChip key={genre.id} label={genre.name} selected={selected.includes(genre.id)}
          disabled={disabledIds?.includes(genre.id) || (!selected.includes(genre.id) && selected.length >= max)}
          onPress={() => onToggle(genre.id)} />
      ))}
    </ChipGroup>
  );
}

export function MovieReactionCard({ movie, reaction, onChange }: {
  movie: OnboardingMovie;
  reaction?: -1 | 1;
  onChange: (value: -1 | 1 | undefined) => void;
}) {
  const [failedPoster, setFailedPoster] = useState(false);
  return (
    <View style={[styles.movieCard, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
      {movie.posterUrl && !failedPoster
        ? <Image source={{ uri: movie.posterUrl }} style={styles.poster} resizeMode="cover" onError={() => setFailedPoster(true)} />
        : <View accessibilityLabel={lang.onboarding.posterUnavailable}
            style={[styles.poster, styles.posterPlaceholder, { backgroundColor: theme.background }]}>
            <Ionicons name="film-outline" size={28} color={theme.mutedText} />
          </View>}
      <View style={styles.movieContent}>
        <Text numberOfLines={2} style={[styles.movieTitle, { color: theme.text }]}>{movie.title}</Text>
        <View style={styles.reactionRow}>
          <ChoiceChip label={lang.onboarding.like} selected={reaction === 1}
            onPress={() => onChange(reaction === 1 ? undefined : 1)} />
          <ChoiceChip label={lang.onboarding.notForMe} selected={reaction === -1}
            onPress={() => onChange(reaction === -1 ? undefined : -1)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  progress: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 3, marginHorizontal: 22, marginBottom: 15, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 3 },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 24 },
  body: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, gap: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primaryButton: { minHeight: 52, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  primaryText: { fontSize: 16, fontWeight: '800' },
  skip: { minHeight: 52, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  reload: { fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontSize: 14, fontWeight: '700' },
  scaleList: { gap: 9 },
  scaleCard: { minHeight: 58, paddingHorizontal: 14, borderWidth: 1, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', gap: 12 },
  scaleNumber: { fontSize: 18, fontWeight: '900', minWidth: 23 },
  scaleLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  movieCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 9, gap: 10 },
  poster: { width: 68, height: 100, borderRadius: 9 },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  movieContent: { flex: 1, justifyContent: 'space-between', gap: 5 },
  movieTitle: { fontSize: 14, fontWeight: '800' },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
