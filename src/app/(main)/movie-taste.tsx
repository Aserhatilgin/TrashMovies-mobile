import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { MovieTasteForm } from '../../components/movie-taste/MovieTasteForm';
import { MovieTasteSummary } from '../../components/movie-taste/MovieTasteSummary';
import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import { sameTaste, tasteDraft, tastePayload, validMovieTaste } from '../../features/movie-taste/model';
import { useMovieTaste } from '../../hooks/useMovieTaste';
import type { RootState } from '../../store';
import type { MovieTasteDraft, MovieTasteValues } from '../../types/movieTaste';

interface Editing { draft: MovieTasteDraft; original: MovieTasteValues; revision: number }

export default function MovieTasteScreen() {
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const generation = useSelector((s: RootState) => s.auth.sessionGeneration);
  return userId ? <MovieTasteContent key={`${userId}:${generation}`} userId={userId} sessionGeneration={generation} /> : null;
}

function MovieTasteContent({ userId, sessionGeneration }: { userId: string; sessionGeneration: number }) {
  const router = useRouter();
  const taste = useMovieTaste(userId, sessionGeneration);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saved, setSaved] = useState(false);
  const editGeneration = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const dirty = editing !== null && !sameTaste(editing.original, tastePayload(editing.draft));
  const confirmDiscard = useCallback((action: () => void) => {
    if (!dirty) { action(); return; }
    Alert.alert(lang.movieTaste.discardTitle, lang.movieTaste.discardBody, [
      { text: lang.movieTaste.keepEditing, style: 'cancel' },
      { text: lang.movieTaste.discard, style: 'destructive', onPress: action },
    ]);
  }, [dirty]);
  const leave = useCallback(() => {
    if (taste.saving) return;
    if (editing) confirmDiscard(() => { editGeneration.current += 1; setEditing(null); }); else router.back();
  }, [taste.saving, editing, confirmDiscard, router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leave(); return true;
    });
    return () => subscription.remove();
  }, [leave]));
  const beginEditing = () => {
    if (!taste.snapshot || taste.saving) return;
    const draft = tasteDraft(taste.snapshot);
    editGeneration.current += 1;
    taste.clearSaveError();
    setEditing({ draft, original: tastePayload(draft), revision: taste.snapshot.revision });
    setSaved(false); scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const save = async () => {
    if (!editing || !validMovieTaste(editing.draft) || taste.saving) return;
    if (await taste.save(editing.revision, tastePayload(editing.draft))) {
      setEditing(null); setSaved(true); scroll.current?.scrollTo({ y: 0, animated: false });
    }
  };
  const reloadDraft = () => confirmDiscard(() => {
    const captured = ++editGeneration.current;
    void taste.reload().then((snapshot) => {
      if (!snapshot || captured !== editGeneration.current) return;
      const draft = tasteDraft(snapshot);
      taste.clearSaveError();
      setEditing({ draft, original: tastePayload(draft), revision: snapshot.revision });
    });
  });
  const snapshot = taste.snapshot;
  return <SafeAreaView edges={['bottom']} style={[styles.page, { backgroundColor: theme.background }]}>
    <Stack.Screen options={{ headerShown: true, title: lang.profile.movieTaste,
      headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.text,
      // The form is a mode in this route. Native swiping would remove the route
      // without running the same discard/save guard used by the header/Android.
      gestureEnabled: !editing && !taste.saving, headerBackVisible: false,
      headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={lang.onboarding.back}
        disabled={taste.saving} onPress={leave} style={styles.back}>
        <Ionicons name="arrow-back" color={theme.text} size={24} />
      </Pressable>,
    }} />
    <ScrollView ref={scroll} contentContainerStyle={styles.content}>
      {taste.loading ? <ActivityIndicator accessibilityLabel={lang.movieTaste.loading} color={theme.primary} /> : null}
      {taste.loadError ? <View style={styles.status}>
        <Text accessibilityRole="alert" style={{ color: theme.text }}>{lang.movieTaste.loadError}</Text>
        <Pressable accessibilityRole="button" disabled={taste.loading || taste.saving} onPress={() => void taste.reload()}>
          <Text style={{ color: theme.primary }}>{lang.movieTaste.retry}</Text>
        </Pressable>
      </View> : null}
      {snapshot && editing ? <View pointerEvents={taste.saving || taste.loading ? 'none' : 'auto'} style={styles.form}>
        <MovieTasteForm snapshot={snapshot} draft={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} />
      </View> : snapshot ? <MovieTasteSummary snapshot={snapshot} /> : null}
      {saved && !editing ? <Text accessibilityRole="alert" style={{ color: theme.text }}>{lang.movieTaste.saved}</Text> : null}
    </ScrollView>
    {snapshot ? <View style={[styles.footer, { borderTopColor: theme.inputBorder }]}>
      {editing && taste.saveError ? <>
        <Text accessibilityRole="alert" style={{ color: theme.primary }}>
          {taste.saveError === 'conflict' ? lang.movieTaste.conflict : lang.movieTaste.saveError}
        </Text>
        <Pressable accessibilityRole="button" disabled={taste.saving || taste.loading} onPress={reloadDraft}>
          <Text style={[styles.reload, { color: theme.text }]}>{lang.movieTaste.reload}</Text>
        </Pressable>
      </> : null}
      {editing && !validMovieTaste(editing.draft) ? <Text style={{ color: theme.mutedText }}>{lang.movieTaste.requiredHint}</Text> : null}
      <View style={styles.actions}>
        {editing ? <Pressable accessibilityRole="button" disabled={taste.saving} onPress={leave} style={styles.cancel}>
          <Text style={{ color: theme.text }}>{lang.movieTaste.cancel}</Text>
        </Pressable> : null}
        <Pressable accessibilityRole="button" disabled={taste.saving || taste.loading || (editing !== null && (!dirty || !validMovieTaste(editing.draft)))}
          onPress={editing ? () => void save() : beginEditing}
          style={[styles.primary, { backgroundColor: theme.primary,
            opacity: taste.saving || taste.loading || (editing && (!dirty || !validMovieTaste(editing.draft))) ? 0.45 : 1 }]}>
          {taste.saving ? <ActivityIndicator accessibilityLabel={lang.movieTaste.saving} color={theme.text} />
            : <Text style={[styles.buttonText, { color: theme.text }]}>{editing ? lang.movieTaste.save : lang.movieTaste.edit}</Text>}
        </Pressable>
      </View>
    </View> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 20, gap: 18, flexGrow: 1 }, form: { gap: 28 },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, status: { gap: 16 },
  footer: { borderTopWidth: 1, padding: 16, gap: 10 }, actions: { flexDirection: 'row', gap: 16 },
  primary: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  cancel: { minHeight: 50, justifyContent: 'center', paddingHorizontal: 12 }, reload: { paddingVertical: 8 },
});
