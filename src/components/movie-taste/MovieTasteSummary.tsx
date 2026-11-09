import { StyleSheet, Text, View } from 'react-native';
import { ProfileCard } from '../ProfileCard';
import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import type { MovieTasteSnapshot } from '../../types/movieTaste';

function Value({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <Text style={[styles.value, { color: theme.mutedText }]}>{value}</Text>
  </View>;
}

export function MovieTasteSummary({ snapshot }: { snapshot: MovieTasteSnapshot }) {
  const p = snapshot.preferences;
  const unanswered = lang.onboarding.resultNotAnswered;
  const joined = (values: string[]) => values.length ? values.join(', ') : lang.movieTaste.none;
  const scale = (value: number | null, labels: readonly string[]) => value === null ? unanswered : `${value} / ${labels.length} · ${labels[value - 1]}`;
  const genres = (ids: string[]) => joined(ids.map((id) => snapshot.genres.find((g) => g.id === id)?.name ?? id));
  return <>
    <ProfileCard>
      <Value label={lang.movieTaste.likedGenres} value={genres(p.liked_genres)} />
      <Value label={lang.movieTaste.dislikedGenres} value={genres(p.disliked_genres)} />
      <Value label={lang.movieTaste.priorities} value={p.movie_priorities === null ? unanswered : joined(p.movie_priorities.map((k) => lang.onboarding.priorities[k]))} />
      <Value label={lang.movieTaste.intents} value={p.watch_intents === null ? unanswered : joined(p.watch_intents.map((k) => lang.onboarding.intents[k]))} />
    </ProfileCard>
    <ProfileCard>
      <Value label={lang.movieTaste.trash} value={scale(p.trash_tolerance, lang.onboarding.trashLabels)} />
      <Value label={lang.movieTaste.discovery} value={scale(p.discovery_level, lang.onboarding.discoveryLabels)} />
      <Value label={lang.movieTaste.popularity} value={scale(p.popularity_preference, lang.onboarding.popularityLabels)} />
      <Value label={lang.onboarding.classic} value={scale(p.classic_openness, lang.onboarding.scaleLabels)} />
      <Value label={lang.onboarding.international} value={scale(p.international_openness, lang.onboarding.scaleLabels)} />
      <Value label={lang.onboarding.runtime} value={p.runtime_preference === null ? unanswered : lang.onboarding.runtimeLabels[p.runtime_preference]} />
    </ProfileCard>
    <ProfileCard>
      <Value label={lang.movieTaste.reactions} value={Object.keys(p.movie_reactions).length ? Object.entries(p.movie_reactions).map(([id, reaction]) =>
        `${snapshot.movies.find((m) => m.id === id)?.title ?? id} · ${reaction === 1 ? lang.movieTaste.like : lang.movieTaste.dislike}`).join('\n') : lang.movieTaste.none} />
      <Value label={lang.movieTaste.knowledge} value={p.movie_knowledge_self_rating === null ? unanswered : `${p.movie_knowledge_self_rating} / 10`} />
      <Text style={{ color: theme.mutedText }}>{lang.onboarding.selfRatingHint}</Text>
    </ProfileCard>
  </>;
}

const styles = StyleSheet.create({ field: { gap: 5, marginBottom: 16 }, label: { fontSize: 16, fontWeight: '700' }, value: { fontSize: 15, lineHeight: 23 } });
