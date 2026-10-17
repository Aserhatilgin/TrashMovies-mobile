import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { AVATAR_CATALOG } from '../../constants/Avatars';
import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import {
  AGE_KEYS, CORE_STEPS, GENDER_KEYS, INTENT_KEYS, OPTIONAL_STEPS,
  PRIORITY_KEYS, RUNTIME_KEYS, canChooseDisliked, deriveTasteProfile, hydrateDraft,
  moviePageAction, MOVIES_PER_PAGE, nextStep, previousStep, reconcileDraftGenres, resumeStep,
  skipOptionalSection, skipOptionalStep, toggleLimited, validCore, validStep,
  type FlowStep, type OnboardingDraft, type Reaction, type StepId,
} from '../../features/onboarding/onboardingV1';
import {
  ChipGroup, ChoiceChip, GenreChoices, MovieReactionCard, OnboardingShell, ResultTag, ScaleSelector,
} from '../../features/onboarding/components';
import {
  completeOnboarding, fetchOnboardingGenres, fetchOnboardingMovies, saveOnboardingProgress,
  type OnboardingGenre, type OnboardingMovie,
} from '../../services/onboarding';
import { initializeUserDomain, type UserDomainBootstrap } from '../../services/userDomain';
import { OnboardingOperations, onboardingErrorCode } from '../../features/onboarding/onboardingOperations';
import { store, type AppDispatch, type RootState } from '../../store';
import { acceptCompletedUserDomain } from '../../store/userDomainSlice';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type ErrorKind = 'invalid' | 'save' | 'conflict' | 'complete' | null;

function LoadingScreen({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <SafeAreaView style={[styles.full, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        {error ? <Text style={[styles.centerText, { color: theme.text }]}>{error}</Text>
          : <ActivityIndicator size="large" color={theme.primary} />}
        {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={[styles.retryText, { color: theme.text }]}>{lang.onboarding.retry}</Text>
        </Pressable> : null}
      </View>
    </SafeAreaView>
  );
}

function DetailLabel({ children, optional = false }: { children: ReactNode; optional?: boolean }) {
  return (
    <Text style={[styles.detailLabel, { color: theme.text }]}>
      {children}{optional ? ' · ' + lang.onboarding.optional : ''}
    </Text>
  );
}

export default function OnboardingIndex() {
  const params = useLocalSearchParams<{ preview?: string }>();
  const preview = __DEV__ && params.preview === '1';
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const sessionGeneration = useSelector((state: RootState) => state.auth.sessionGeneration);
  return userId ? <OnboardingFlow key={userId + ':' + sessionGeneration + ':' + preview}
    userId={userId} sessionGeneration={sessionGeneration} preview={preview} /> : null;
}

function OnboardingFlow({ userId, sessionGeneration, preview }: { userId: string; sessionGeneration: number; preview: boolean }) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const operations = useMemo(() => new OnboardingOperations(userId, preview, {
    currentUserId: () => {
      const auth = store.getState().auth;
      return auth.sessionGeneration === sessionGeneration ? auth.user?.id ?? null : null;
    },
    initialize: initializeUserDomain,
    save: saveOnboardingProgress,
    complete: completeOnboarding,
  }), [userId, sessionGeneration, preview]);
  const { width } = useWindowDimensions();
  const [boot, setBoot] = useState<LoadState>(preview ? 'ready' : 'loading');
  const [bootAttempt, setBootAttempt] = useState(0);
  const [step, setStep] = useState<FlowStep>('display_name');
  const [draft, setDraft] = useState<OnboardingDraft>({});
  const [genreStatus, setGenreStatus] = useState<LoadState>('idle');
  const [genres, setGenres] = useState<OnboardingGenre[]>([]);
  const [movieStatus, setMovieStatus] = useState<LoadState>('idle');
  const [movies, setMovies] = useState<OnboardingMovie[]>([]);
  const [moviePage, setMoviePage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [result, setResult] = useState(false);
  useEffect(() => {
    operations.activate();
    // Subscription invalidates synchronously, before React commits a new route.
    const unsubscribe = store.subscribe(() => {
      const auth = store.getState().auth;
      if (auth.user?.id !== userId || auth.sessionGeneration !== sessionGeneration) operations.invalidate();
    });
    return () => { unsubscribe(); operations.invalidate(); };
  }, [operations, userId, sessionGeneration]);

  const routeCompleted = (domain: UserDomainBootstrap) => {
    if (!domain.onboarding.requiredCompleted || domain.profile.id !== userId) return;
    dispatch(acceptCompletedUserDomain(userId));
    // The root route is always available, including before protected routes rerender.
    router.replace('/');
  };

  useEffect(() => {
    if (preview) return;
    const generation = operations.capture();
    const load = async () => {
      try {
        const domain = await operations.initialize();
        if (!operations.isCurrent(generation) || !domain) return;
        if (domain.onboarding.requiredCompleted) {
          dispatch(acceptCompletedUserDomain(userId));
          router.replace('/');
          return;
        }
        const rows = await operations.network((signal) => fetchOnboardingGenres(signal));
        if (!operations.isCurrent(generation)) return;
        const progress = domain.onboarding.requiredProgress!;
        const restored = reconcileDraftGenres(hydrateDraft(progress.responses), rows);
        setGenres(rows);
        setGenreStatus('ready');
        setDraft(restored);
        setStep(resumeStep(progress.currentStep, restored));
        setBoot('ready');
      } catch {
        if (operations.isCurrent(generation)) setBoot('error');
      }
    };
    void load();
  }, [operations, preview, userId, bootAttempt, dispatch, router]);

  useEffect(() => {
    if ((step !== 'liked_genres' && step !== 'disliked_genres' && !result) || genreStatus !== 'idle') return;
    const generation = operations.capture();
    setGenreStatus('loading');
    operations.network((signal) => fetchOnboardingGenres(signal)).then((rows) => {
      if (!operations.isCurrent(generation)) return;
      setGenres(rows);
      setDraft((current) => reconcileDraftGenres(current, rows));
      setGenreStatus('ready');
    }).catch(() => { if (operations.isCurrent(generation)) setGenreStatus('error'); });
  }, [step, genreStatus, result, operations]);

  useEffect(() => {
    if (step !== 'movie_reactions' || movieStatus !== 'idle') return;
    const generation = operations.capture();
    setMovieStatus('loading');
    operations.network((signal) => fetchOnboardingMovies(preview, signal)).then((rows) => {
      if (!operations.isCurrent(generation)) return;
      setMovies(rows);
      setMovieStatus('ready');
    }).catch(() => { if (operations.isCurrent(generation)) setMovieStatus('error'); });
  }, [step, movieStatus, preview, operations]);

  const update = (patch: Partial<OnboardingDraft>) => {
    if (operations.busy || !operations.isCurrent(operations.capture())) return;
    setDraft((current) => ({ ...current, ...patch }));
    setErrorKind(null);
  };

  const submit = async (action: 'next' | 'skip') => {
    const generation = operations.capture();
    if (operations.busy || !operations.isCurrent(generation)) return;
    if (action === 'next' && step !== 'optional_intro' && !validStep(step as StepId, draft)) {
      setErrorKind('invalid');
      return;
    }
    if (step === 'optional_intro' && !validCore(draft)) {
      setErrorKind('invalid');
      return;
    }
    if (step === 'movie_reactions' && action === 'next') {
      const nextPage = moviePageAction(moviePage, 'next');
      if (nextPage !== null) { setMoviePage(nextPage); return; }
    }
    setBusy(true);
    setErrorKind(null);
    const finish = (step === 'optional_intro' && action === 'skip') || step === 'demographics';
    try {
      const snapshot = step === 'optional_intro' && action === 'skip'
        ? skipOptionalSection(draft)
        : action === 'skip' ? skipOptionalStep(draft, step as StepId) : draft;
      const upcoming = finish ? step : nextStep(step);
      if (!upcoming) throw new Error('Invalid onboarding step.');
      const outcome = await operations.submit(snapshot, upcoming, finish);
      if (!operations.isCurrent(generation) || !outcome) return;
      if (outcome.kind === 'reconciled') {
        routeCompleted(outcome.domain);
      } else if (outcome.kind === 'completed') {
        setDraft(reconcileDraftGenres(hydrateDraft(outcome.responses), genres));
        setResult(true);
      } else {
        setDraft(snapshot);
        setStep(upcoming);
        setMoviePage(0);
      }
    } catch (error) {
      if (operations.isCurrent(generation)) {
        setErrorKind(onboardingErrorCode(error) === '40001' ? 'conflict' : finish ? 'complete' : 'save');
      }
    } finally {
      if (operations.isCurrent(generation)) setBusy(false);
    }
  };

  const reloadServerDraft = async () => {
    const generation = operations.capture();
    if (preview || operations.busy || !operations.isCurrent(generation)) return;
    setBusy(true);
    try {
      const domain = await operations.initialize();
      if (!operations.isCurrent(generation) || !domain) return;
      if (domain.onboarding.requiredCompleted) { routeCompleted(domain); return; }
      const progress = domain.onboarding.requiredProgress!;
      const restored = reconcileDraftGenres(hydrateDraft(progress.responses), genres);
      setDraft(restored);
      setStep(resumeStep(progress.currentStep, restored));
      setMoviePage(0);
      setErrorKind(null);
    } catch {
      if (operations.isCurrent(generation)) setErrorKind('conflict');
    } finally {
      if (operations.isCurrent(generation)) setBusy(false);
    }
  };

  const leaveResult = async () => {
    if (preview) { router.back(); return; }
    const generation = operations.capture();
    if (operations.busy || !operations.isCurrent(generation)) return;
    setBusy(true);
    setErrorKind(null);
    try {
      const domain = await operations.initialize();
      if (!operations.isCurrent(generation) || !domain) return;
      if (!domain.onboarding.requiredCompleted) throw new Error('Completion routing not confirmed.');
      routeCompleted(domain);
    } catch {
      if (operations.isCurrent(generation)) setErrorKind('complete');
    } finally {
      if (operations.isCurrent(generation)) setBusy(false);
    }
  };

  const goBack = () => {
    if (operations.busy || !operations.isCurrent(operations.capture())) return;
    if (step === 'movie_reactions') {
      const priorPage = moviePageAction(moviePage, 'back');
      if (priorPage !== null) { setMoviePage(priorPage); return; }
    }
    const prior = previousStep(step);
    if (prior) { setStep(prior); setErrorKind(null); }
    else if (preview) router.back();
  };

  if (!preview && boot !== 'ready') {
    return <LoadingScreen error={boot === 'error' ? lang.onboarding.bootstrapError : undefined}
      onRetry={boot === 'error' ? () => { setBoot('loading'); setBootAttempt((n) => n + 1); } : undefined} />;
  }

  const genreNeeded = step === 'liked_genres' || step === 'disliked_genres';
  const movieNeeded = step === 'movie_reactions';
  const dataStatus = genreNeeded ? genreStatus : movieNeeded ? movieStatus : 'ready';
  const retryData = () => {
    if (genreNeeded) setGenreStatus('idle');
    if (movieNeeded) setMovieStatus('idle');
  };
  const progress = step === 'optional_intro'
    ? lang.onboarding.optional
    : CORE_STEPS.includes(step as typeof CORE_STEPS[number])
      ? lang.onboarding.coreProgress + ' ' + (CORE_STEPS.indexOf(step as typeof CORE_STEPS[number]) + 1) + ' / 7'
      : lang.onboarding.optionalProgress + ' ' + (OPTIONAL_STEPS.indexOf(step as typeof OPTIONAL_STEPS[number]) + 1) + ' / 5';
  const error = errorKind === 'invalid' ? lang.onboarding.requiredHint
    : errorKind === 'save' ? lang.onboarding.saveError
      : errorKind === 'conflict' ? lang.onboarding.conflictError
        : errorKind === 'complete' ? lang.onboarding.completeError : null;

  if (result) {
    const taste = deriveTasteProfile(draft);
    const dimensions = [
      [lang.onboarding.resultDiscovery, taste.discovery],
      [lang.onboarding.resultTrash, taste.trash],
      [lang.onboarding.resultClassic, taste.classic],
      [lang.onboarding.resultInternational, taste.international],
    ] as const;
    return (
      <SafeAreaView style={[styles.full, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <View style={[styles.resultIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="sparkles" size={30} color={theme.text} />
          </View>
          <Text style={[styles.resultTitle, { color: theme.text }]}>{lang.onboarding.resultTitle}</Text>
          <Text style={[styles.resultSubtitle, { color: theme.mutedText }]}>{lang.onboarding.resultSubtitle}</Text>
          <View style={[styles.resultCard, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
            <Text style={[styles.mode, { color: theme.text }]}>{lang.onboarding.modes[taste.mode]}</Text>
            {dimensions.map(([label, value]) => (
              <View key={label} style={styles.dimension}>
                <View style={styles.dimensionHeader}>
                  <Text style={[styles.dimensionLabel, { color: theme.text }]}>{label}</Text>
                  <Text style={[styles.dimensionValue, { color: theme.mutedText }]}>
                    {value === null ? lang.onboarding.resultNotAnswered : value + '%'}
                  </Text>
                </View>
                {value !== null ? <View style={[styles.track, { backgroundColor: theme.inputBorder }]}>
                  <View style={[styles.fill, { backgroundColor: theme.primary, width: (value + '%') as `${number}%` }]} />
                </View> : null}
              </View>
            ))}
          </View>
          {draft.liked_genres?.length ? <View style={styles.resultGroup}>
            <DetailLabel>{lang.onboarding.resultFavoriteGenres}</DetailLabel>
            <ChipGroup>{draft.liked_genres.map((id) => {
              const genre = genres.find((item) => item.id === id);
              return genre ? <ResultTag key={id} label={genre.name} /> : null;
            })}</ChipGroup>
          </View> : null}
          {draft.movie_priorities?.length ? <View style={styles.resultGroup}>
            <DetailLabel>{lang.onboarding.resultPriorities}</DetailLabel>
            <ChipGroup>{draft.movie_priorities.map((key) =>
              <ResultTag key={key} label={lang.onboarding.priorities[key]} />)}</ChipGroup>
          </View> : null}
          {draft.exploration_preferences?.runtime_preference ? <View style={styles.resultGroup}>
            <DetailLabel>{lang.onboarding.resultRuntime}</DetailLabel>
            <Text style={[styles.resultText, { color: theme.text }]}>
              {lang.onboarding.runtimeLabels[draft.exploration_preferences.runtime_preference]}
            </Text>
          </View> : null}
          <Text style={[styles.disclaimer, { color: theme.mutedText }]}>{lang.onboarding.resultDisclaimer}</Text>
        </ScrollView>
        <View style={[styles.resultFooter, { borderTopColor: theme.inputBorder }]}>
          {error ? <Text accessibilityRole="alert" style={[styles.hint, { color: theme.primary }]}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void leaveResult()} disabled={busy}
            style={[styles.resultButton, { backgroundColor: theme.primary }]}>
            <Text style={[styles.resultButtonText, { color: theme.text }]}>
              {preview ? lang.onboarding.previewExit : lang.onboarding.enter}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const content = (): ReactNode => {
    if (dataStatus !== 'ready') {
      return <View style={styles.dataState}>
        {dataStatus === 'loading' || dataStatus === 'idle' ? <ActivityIndicator color={theme.primary} /> : (
          <Pressable accessibilityRole="button" onPress={retryData} style={styles.retry}>
            <Text style={[styles.centerText, { color: theme.text }]}>{lang.onboarding.loadError}</Text>
            <Text style={[styles.retryText, { color: theme.text }]}>{lang.onboarding.retry}</Text>
          </Pressable>
        )}
      </View>;
    }
    switch (step) {
      case 'display_name':
        return <TextInput value={draft.display_name ?? ''} maxLength={60} autoCapitalize="words"
          returnKeyType="done" accessibilityLabel={lang.onboarding.titles.display_name}
          placeholder={lang.onboarding.displayNamePlaceholder} placeholderTextColor={theme.mutedText}
          onChangeText={(value) => update({ display_name: value })}
          style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} />;
      case 'avatar_choice': {
        const columns = width < 360 ? 3 : 4;
        const gridWidth = Math.min(width - 44, 480);
        const size = (gridWidth - (columns - 1) * 10) / columns;
        return <View style={[styles.avatarGrid, { maxWidth: gridWidth }]}>
          {AVATAR_CATALOG.map((avatar) => {
            const selected = draft.avatar_choice === avatar.key;
            return <Pressable key={avatar.key} accessibilityRole="radio"
              accessibilityLabel={lang.onboarding.avatarLabel + ' ' + avatar.key}
              accessibilityState={{ selected }} onPress={() => update({ avatar_choice: avatar.key })}
              style={[styles.avatarCell, { width: size, borderColor: selected ? theme.primary : theme.inputBorder,
                backgroundColor: theme.inputBg }]}>
              <Image source={avatar.image} style={{ width: size - 16, height: size - 16 }} resizeMode="contain" />
              {selected ? <Ionicons name="checkmark-circle" size={24} color={theme.primary} style={styles.avatarCheck} /> : null}
            </Pressable>;
          })}
        </View>;
      }
      case 'liked_genres':
        return <><Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.genreHint}</Text>
          <GenreChoices genres={genres} selected={draft.liked_genres ?? []} max={5}
            onToggle={(id) => update({ liked_genres: toggleLimited(draft.liked_genres, id, 5),
              disliked_genres: draft.disliked_genres?.filter((value) => value !== id) })} /></>;
      case 'movie_priorities':
        return <><Text style={[styles.hint, { color: theme.mutedText }]}>
          {lang.onboarding.countSelected + ': ' + (draft.movie_priorities?.length ?? 0) + ' / 3'}</Text>
          <ChipGroup>{PRIORITY_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.priorities[key]}
            selected={draft.movie_priorities?.includes(key) ?? false}
            disabled={(draft.movie_priorities?.length ?? 0) >= 3 && !draft.movie_priorities?.includes(key)}
            onPress={() => update({ movie_priorities: toggleLimited(draft.movie_priorities, key, 3) })} />)}</ChipGroup></>;
      case 'watch_intent':
        return <><Text style={[styles.hint, { color: theme.mutedText }]}>
          {lang.onboarding.countSelected + ': ' + (draft.watch_intent?.length ?? 0) + ' / 3'}</Text>
          <ChipGroup>{INTENT_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.intents[key]}
            selected={draft.watch_intent?.includes(key) ?? false}
            disabled={(draft.watch_intent?.length ?? 0) >= 3 && !draft.watch_intent?.includes(key)}
            onPress={() => update({ watch_intent: toggleLimited(draft.watch_intent, key, 3) })} />)}</ChipGroup></>;
      case 'trash_tolerance':
        return <ScaleSelector value={draft.trash_tolerance}
          onSelect={(value) => update({ trash_tolerance: value })} labels={lang.onboarding.trashLabels} />;
      case 'discovery_preferences':
        return <><ScaleSelector value={draft.discovery_preferences?.discovery_level}
          onSelect={(value) => update({ discovery_preferences: { ...draft.discovery_preferences, discovery_level: value } })}
          labels={lang.onboarding.discoveryLabels} />
          <DetailLabel optional>{lang.onboarding.popularity}</DetailLabel>
          <ScaleSelector value={draft.discovery_preferences?.popularity_preference} allowClear
            onSelect={(value) => update({ discovery_preferences: { ...draft.discovery_preferences, popularity_preference: value } })}
            labels={lang.onboarding.popularityLabels} />
          <Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.clearHint}</Text></>;
      case 'optional_intro':
        return <View style={[styles.introCard, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
          <Ionicons name="film-outline" size={36} color={theme.primary} />
          <Text style={[styles.introText, { color: theme.text }]}>{lang.onboarding.optionalIntroBody}</Text>
        </View>;
      case 'disliked_genres':
        return <><Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.dislikedHint}</Text>
          <GenreChoices genres={genres} selected={draft.disliked_genres ?? []} max={3}
            disabledIds={genres.filter((item) => !canChooseDisliked(draft, item.id)).map((item) => item.id)}
            onToggle={(id) => update({ disliked_genres: toggleLimited(draft.disliked_genres, id, 3) })} /></>;
      case 'movie_reactions': {
        const start = moviePage * MOVIES_PER_PAGE;
        return <><Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.movieHint}</Text>
          <Text style={[styles.detailLabel, { color: theme.text }]}>
            {lang.onboarding.reactionPage + ' ' + (moviePage + 1) + ' / 3'}</Text>
          {movies.slice(start, start + MOVIES_PER_PAGE).map((movie) => <MovieReactionCard key={movie.id} movie={movie}
            reaction={draft.movie_reactions?.[movie.id]}
            onChange={(value: Reaction | undefined) => {
              const reactions = { ...draft.movie_reactions };
              if (value === undefined) delete reactions[movie.id];
              else reactions[movie.id] = value;
              update({ movie_reactions: reactions });
            }} />)}
        </>;
      }
      case 'exploration_preferences':
        return <><DetailLabel optional>{lang.onboarding.classic}</DetailLabel>
          <Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.classicHint}</Text>
          <ScaleSelector value={draft.exploration_preferences?.classic_openness} allowClear
            onSelect={(value) => update({ exploration_preferences: { ...draft.exploration_preferences, classic_openness: value } })}
            labels={lang.onboarding.scaleLabels} />
          <DetailLabel optional>{lang.onboarding.international}</DetailLabel>
          <Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.internationalHint}</Text>
          <ScaleSelector value={draft.exploration_preferences?.international_openness} allowClear
            onSelect={(value) => update({ exploration_preferences: { ...draft.exploration_preferences, international_openness: value } })}
            labels={lang.onboarding.scaleLabels} />
          <DetailLabel optional>{lang.onboarding.runtime}</DetailLabel>
          <ChipGroup>{RUNTIME_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.runtimeLabels[key]}
            selected={draft.exploration_preferences?.runtime_preference === key}
            onPress={() => update({ exploration_preferences: { ...draft.exploration_preferences,
              runtime_preference: draft.exploration_preferences?.runtime_preference === key ? undefined : key } })} />)}</ChipGroup></>;
      case 'movie_knowledge_self_rating':
        return <><Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.selfRatingHint}</Text>
          <ChipGroup>{lang.onboarding.knowledgeLabels.map((label, index) => <ChoiceChip key={label} label={label}
            selected={draft.movie_knowledge_self_rating === index + 1}
            onPress={() => update({ movie_knowledge_self_rating:
              draft.movie_knowledge_self_rating === index + 1 ? undefined : index + 1 })} />)}</ChipGroup></>;
      case 'demographics':
        return <><Text style={[styles.hint, { color: theme.mutedText }]}>{lang.onboarding.demographicHint}</Text>
          <DetailLabel optional>{lang.onboarding.age}</DetailLabel>
          <ChipGroup>{AGE_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.ageLabels[key]}
            selected={draft.demographics?.age_range === key}
            onPress={() => update({ demographics: { ...draft.demographics,
              age_range: draft.demographics?.age_range === key ? undefined : key } })} />)}</ChipGroup>
          <DetailLabel optional>{lang.onboarding.gender}</DetailLabel>
          <ChipGroup>{GENDER_KEYS.map((key) => <ChoiceChip key={key} label={lang.onboarding.genderLabels[key]}
            selected={draft.demographics?.gender === key}
            onPress={() => update({ demographics: { ...draft.demographics,
              gender: draft.demographics?.gender === key ? undefined : key } })} />)}</ChipGroup></>;
    }
  };

  return (
    <OnboardingShell stepKey={step === 'movie_reactions' ? step + ':' + moviePage : step} title={step === 'optional_intro'
      ? lang.onboarding.optionalIntroTitle : lang.onboarding.titles[step]}
      subtitle={preview ? lang.onboarding.previewNote : undefined} progress={progress}
      progressFraction={step === 'optional_intro' ? 1
        : CORE_STEPS.includes(step as typeof CORE_STEPS[number])
          ? (CORE_STEPS.indexOf(step as typeof CORE_STEPS[number]) + 1) / CORE_STEPS.length
          : (OPTIONAL_STEPS.indexOf(step as typeof OPTIONAL_STEPS[number]) + 1) / OPTIONAL_STEPS.length}
      onBack={previousStep(step) || preview ? goBack : undefined}
      onContinue={() => void submit('next')} onSkip={step === 'optional_intro' || OPTIONAL_STEPS.includes(step as typeof OPTIONAL_STEPS[number])
        ? () => void submit('skip') : undefined}
      skipLabel={step === 'optional_intro' ? lang.onboarding.optionalIntroSkip : undefined}
      continueLabel={step === 'movie_reactions' && moviePageAction(moviePage, 'next') !== null
        ? lang.onboarding.nextMovies : step === 'demographics' ? lang.onboarding.finish : undefined}
      canContinue={dataStatus === 'ready' && (step === 'optional_intro' || !CORE_STEPS.includes(step as typeof CORE_STEPS[number])
        || validStep(step as StepId, draft))}
      busy={busy} error={error} onReload={errorKind === 'conflict' ? reloadServerDraft : undefined}>
      {content()}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  centerText: { fontSize: 16, textAlign: 'center' },
  retry: { padding: 15, alignItems: 'center', gap: 8 },
  retryText: { fontSize: 15, fontWeight: '800' },
  input: { minHeight: 56, paddingHorizontal: 16, borderWidth: 1, borderRadius: 15, fontSize: 17 },
  detailLabel: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 14, lineHeight: 20 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignSelf: 'center' },
  avatarCell: { borderWidth: 2, borderRadius: 16, padding: 6, alignItems: 'center', justifyContent: 'center' },
  avatarCheck: { position: 'absolute', right: 2, bottom: 2 },
  introCard: { borderWidth: 1, borderRadius: 20, padding: 24, gap: 16, alignItems: 'center' },
  introText: { fontSize: 17, lineHeight: 24, textAlign: 'center' },
  dataState: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  resultScroll: { padding: 22, paddingBottom: 32, gap: 17, width: '100%', maxWidth: 560, alignSelf: 'center' },
  resultIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 30, fontWeight: '900' },
  resultSubtitle: { fontSize: 15, lineHeight: 21 },
  resultCard: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 20 },
  mode: { fontSize: 24, fontWeight: '900' },
  dimension: { gap: 8 },
  dimensionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  dimensionLabel: { fontSize: 14, fontWeight: '700' },
  dimensionValue: { fontSize: 14, fontWeight: '800' },
  track: { height: 7, borderRadius: 7, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 7 },
  resultGroup: { gap: 9 },
  resultText: { fontSize: 16, fontWeight: '700' },
  disclaimer: { fontSize: 12, lineHeight: 18 },
  resultFooter: { borderTopWidth: 1, padding: 16 },
  resultButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultButtonText: { fontSize: 16, fontWeight: '900' },
});
