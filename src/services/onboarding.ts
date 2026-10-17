import type { OnboardingDraft } from '../features/onboarding/onboardingV1';
import { loadOnboardingMovieRows } from '../features/onboarding/onboardingMovies';
import { supabase } from '../lib/supabase';
import { posterUrlFromPath } from './movies';
import { parseUserOnboardingProgress, type UserOnboardingProgress } from './userDomain';

export interface OnboardingGenre { id: string; name: string }
export interface OnboardingMovie { id: string; title: string; posterUrl: string | null; releaseDate: string | null }

export async function fetchOnboardingGenres(signal?: AbortSignal): Promise<OnboardingGenre[]> {
  const query = supabase.from('genres').select('id, name').order('name');
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error || !data?.length) throw new Error('Could not load genres.');
  return data;
}

export async function fetchOnboardingMovies(preview: boolean, signal?: AbortSignal): Promise<OnboardingMovie[]> {
  const rows = await loadOnboardingMovieRows(preview, {
    positions: async () => {
      const query = supabase.from('onboarding_version_movies').select('position, movie_id')
        .eq('onboarding_version', 1).order('position');
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error || !data) throw new Error('Could not load the curated movie set.');
      return data;
    },
    movies: async (ids) => {
      if (signal?.aborted) throw new Error('Cancelled onboarding movie request.');
      const query = supabase.from('movies').select('id, title, poster_path, release_date').in('id', [...ids]);
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error || !data) throw new Error('Could not load the V1 movies.');
      return data;
    },
  });
  return rows.map((row) => ({ id: row.id, title: row.title,
    posterUrl: row.poster_path ? posterUrlFromPath(row.poster_path) : null, releaseDate: row.release_date }));
}

export async function saveOnboardingProgress(
  version: number,
  expectedRevision: number,
  draft: OnboardingDraft,
  currentStep: string,
  signal?: AbortSignal,
): Promise<UserOnboardingProgress> {
  const query = supabase.rpc('save_onboarding_progress', {
    p_version: version,
    p_expected_revision: expectedRevision,
    p_responses: draft,
    p_current_step: currentStep,
  });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  const progress = parseUserOnboardingProgress(data);
  if (!progress) throw new Error('Missing saved onboarding progress.');
  return progress;
}

export async function completeOnboarding(version: number, expectedRevision: number, signal?: AbortSignal): Promise<UserOnboardingProgress> {
  const query = supabase.rpc('complete_onboarding', {
    p_version: version,
    p_expected_revision: expectedRevision,
  });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  const progress = parseUserOnboardingProgress(data);
  if (!progress?.completedAt) throw new Error('Onboarding completion was not confirmed.');
  return progress;
}
