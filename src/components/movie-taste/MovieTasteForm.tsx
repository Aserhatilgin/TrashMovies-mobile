import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup, ChoiceChip, GenreChoices, MovieReactionCard, ScaleSelector } from '../../features/onboarding/components';
import { INTENT_KEYS, PRIORITY_KEYS, RUNTIME_KEYS, toggleLimited } from '../../features/onboarding/onboardingV1';
import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import type { MovieTasteDraft, MovieTasteSnapshot } from '../../types/movieTaste';

function Field({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return <View style={styles.field}>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
    {hint ? <Text style={[styles.hint, { color: theme.mutedText }]}>{hint}</Text> : null}
    {children}
  </View>;
}

export function MovieTasteForm({ draft, snapshot, onChange }: {
  draft: MovieTasteDraft; snapshot: MovieTasteSnapshot; onChange: (draft: MovieTasteDraft) => void;
}) {
  const update = (patch: Partial<MovieTasteDraft>) => onChange({ ...draft, ...patch });
  const exploration = draft.exploration_preferences;
  return <>
    <Text style={{ color: theme.mutedText }}>{lang.movieTaste.editHint}</Text>
    <Field title={lang.movieTaste.likedGenres} hint={lang.onboarding.genreHint}>
      <GenreChoices genres={snapshot.genres} selected={draft.liked_genres ?? []} disabledIds={draft.disliked_genres} max={5}
        onToggle={(id) => update({ liked_genres: toggleLimited(draft.liked_genres, id, 5) })} />
    </Field>
    <Field title={lang.movieTaste.dislikedGenres} hint={lang.onboarding.dislikedHint}>
      <GenreChoices genres={snapshot.genres} selected={draft.disliked_genres ?? []} disabledIds={draft.liked_genres} max={3}
        onToggle={(id) => update({ disliked_genres: toggleLimited(draft.disliked_genres, id, 3) })} />
    </Field>
    <Field title={lang.movieTaste.priorities}>
      <ChipGroup>{PRIORITY_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.priorities[key]}
        selected={draft.movie_priorities?.includes(key) ?? false}
        disabled={!draft.movie_priorities?.includes(key) && (draft.movie_priorities?.length ?? 0) >= 3}
        onPress={() => update({ movie_priorities: toggleLimited(draft.movie_priorities, key, 3) })} />)}</ChipGroup>
    </Field>
    <Field title={lang.movieTaste.intents}>
      <ChipGroup>{INTENT_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.intents[key]}
        selected={draft.watch_intent?.includes(key) ?? false}
        disabled={!draft.watch_intent?.includes(key) && (draft.watch_intent?.length ?? 0) >= 3}
        onPress={() => update({ watch_intent: toggleLimited(draft.watch_intent, key, 3) })} />)}</ChipGroup>
    </Field>
    <Field title={lang.movieTaste.trash}>
      <ScaleSelector value={draft.trash_tolerance} labels={lang.onboarding.trashLabels} onSelect={(value) => update({ trash_tolerance: value })} />
    </Field>
    <Field title={lang.movieTaste.discovery}>
      <ScaleSelector value={draft.discovery_preferences?.discovery_level} labels={lang.onboarding.discoveryLabels}
        onSelect={(value) => update({ discovery_preferences: { ...draft.discovery_preferences, discovery_level: value } })} />
    </Field>
    <Field title={lang.movieTaste.popularity}>
      <ScaleSelector value={draft.discovery_preferences?.popularity_preference} labels={lang.onboarding.popularityLabels} allowClear
        onSelect={(value) => update({ discovery_preferences: { ...draft.discovery_preferences, popularity_preference: value } })} />
    </Field>
    <Field title={lang.onboarding.classic} hint={lang.onboarding.classicHint}>
      <ScaleSelector value={exploration?.classic_openness} labels={lang.onboarding.scaleLabels} allowClear
        onSelect={(value) => update({ exploration_preferences: { ...exploration, classic_openness: value } })} />
    </Field>
    <Field title={lang.onboarding.international} hint={lang.onboarding.internationalHint}>
      <ScaleSelector value={exploration?.international_openness} labels={lang.onboarding.scaleLabels} allowClear
        onSelect={(value) => update({ exploration_preferences: { ...exploration, international_openness: value } })} />
    </Field>
    <Field title={lang.onboarding.runtime}>
      <ChipGroup>{RUNTIME_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.runtimeLabels[key]}
        selected={exploration?.runtime_preference === key}
        onPress={() => update({ exploration_preferences: { ...exploration, runtime_preference: exploration?.runtime_preference === key ? undefined : key } })} />)}</ChipGroup>
    </Field>
    <Field title={lang.movieTaste.reactions} hint={lang.movieTaste.reactionHint}>
      {snapshot.editableMovieIds.map((id) => {
        const movie = snapshot.movies.find((m) => m.id === id)!;
        return <MovieReactionCard key={id} movie={movie} reaction={draft.movie_reactions?.[id]} onChange={(value) => {
          const reactions = { ...draft.movie_reactions };
          if (value === undefined) delete reactions[id]; else reactions[id] = value;
          update({ movie_reactions: reactions });
        }} />;
      })}
    </Field>
    <Field title={lang.movieTaste.knowledge} hint={lang.onboarding.selfRatingHint}>
      <ChipGroup>{lang.onboarding.knowledgeLabels.map((label, index) => <ChoiceChip key={label} label={label}
        selected={draft.movie_knowledge_self_rating === index + 1}
        onPress={() => update({ movie_knowledge_self_rating: draft.movie_knowledge_self_rating === index + 1 ? undefined : index + 1 })} />)}</ChipGroup>
    </Field>
  </>;
}

const styles = StyleSheet.create({ field: { gap: 12 }, title: { fontSize: 19, fontWeight: '700' }, hint: { fontSize: 14, lineHeight: 21 } });
