import { supabase } from '../lib/supabase';
import { posterUrlFromPath } from './movies';
import type { SavedMovie } from '../types/movie';
import type { MovieInteraction } from '../types/movieInteraction';

interface InteractionRow {
  movie_id: string;
  saved_at: string | null;
  watched_at: string | null;
  rating: number | null;
}

const FIELDS = 'movie_id, saved_at, watched_at, rating';

interface SavedMovieRow {
  saved_at: string;
  movies: {
    id: string;
    title: string;
    poster_path: string;
  };
}

export interface SavedMoviesPage {
  movies: SavedMovie[];
  hasMore: boolean;
}

export async function fetchSavedMovies(limit = 20, offset = 0): Promise<SavedMoviesPage> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0) {
    throw new Error('Invalid saved movie page.');
  }
  const userId = await currentUserId();
  const { data, error } = await supabase.from('user_movie_interactions')
    .select('saved_at, movies!user_movie_interactions_movie_id_fkey(id, title, poster_path)')
    .eq('user_id', userId)
    .not('saved_at', 'is', null)
    .order('saved_at', { ascending: false })
    .order('movie_id', { ascending: true })
    .range(offset, offset + limit)
    .overrideTypes<SavedMovieRow[]>();
  if (error) throw new Error('Unable to load saved movies.');
  const rows = data ?? [];
  return { movies: rows.slice(0, limit).map((row) => ({
    id: row.movies.id,
    title: row.movies.title,
    posterUrl: posterUrlFromPath(row.movies.poster_path),
    savedAt: row.saved_at,
  })), hasMore: rows.length > limit };
}

function mapRow(row: InteractionRow): MovieInteraction {
  return {
    movieId: row.movie_id,
    savedAt: row.saved_at,
    watchedAt: row.watched_at,
    rating: row.rating,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Authentication required.');
  return data.user.id;
}

async function readInteraction(userId: string, movieId: string): Promise<InteractionRow | null> {
  const { data, error } = await supabase
    .from('user_movie_interactions')
    .select(FIELDS)
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .maybeSingle();
  if (error) throw new Error('Unable to read movie interaction.');
  return data as InteractionRow | null;
}

async function readUpdatedInteraction(userId: string, movieId: string): Promise<MovieInteraction | null> {
  const row = await readInteraction(userId, movieId);
  return row ? mapRow(row) : null;
}

export async function fetchMovieInteractions(movieIds: string[]): Promise<Record<string, MovieInteraction>> {
  if (movieIds.length === 0) return {};
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('user_movie_interactions')
    .select(FIELDS)
    .eq('user_id', userId)
    .in('movie_id', movieIds);
  if (error) throw new Error('Unable to load movie interactions.');
  return Object.fromEntries(((data ?? []) as InteractionRow[]).map((row) => [row.movie_id, mapRow(row)]));
}

export async function setMovieSaved(movieId: string, saved: boolean): Promise<MovieInteraction | null> {
  const userId = await currentUserId();
  const existing = await readInteraction(userId, movieId);
  if (saved) {
    if (!existing) {
      const { error } = await supabase.from('user_movie_interactions').insert({
        user_id: userId, movie_id: movieId, saved_at: new Date().toISOString(),
      });
      if (error) throw new Error('Unable to save movie.');
    } else if (existing.saved_at === null) {
      const { error } = await supabase.from('user_movie_interactions')
        .update({ saved_at: new Date().toISOString() })
        .eq('user_id', userId).eq('movie_id', movieId);
      if (error) throw new Error('Unable to save movie.');
    }
  } else if (existing) {
    if (existing.watched_at === null) {
      const { data, error } = await supabase.from('user_movie_interactions')
        .delete().eq('user_id', userId).eq('movie_id', movieId)
        .is('watched_at', null).select(FIELDS).maybeSingle();
      if (error) throw new Error('Unable to unsave movie.');
      if (!data) {
        const { error: updateError } = await supabase.from('user_movie_interactions')
          .update({ saved_at: null }).eq('user_id', userId).eq('movie_id', movieId);
        if (updateError) throw new Error('Unable to unsave movie.');
      }
    } else {
      const { error } = await supabase.from('user_movie_interactions')
        .update({ saved_at: null }).eq('user_id', userId).eq('movie_id', movieId);
      if (error) throw new Error('Unable to unsave movie.');
    }
  }
  return readUpdatedInteraction(userId, movieId);
}

export async function setMovieWatched(movieId: string, watched: boolean): Promise<MovieInteraction | null> {
  const userId = await currentUserId();
  const existing = await readInteraction(userId, movieId);
  if (watched) {
    if (!existing) {
      const { error } = await supabase.from('user_movie_interactions').insert({
        user_id: userId, movie_id: movieId, watched_at: new Date().toISOString(),
      });
      if (error) throw new Error('Unable to mark movie watched.');
    } else if (existing.watched_at === null) {
      const { error } = await supabase.from('user_movie_interactions')
        .update({ watched_at: new Date().toISOString() })
        .eq('user_id', userId).eq('movie_id', movieId);
      if (error) throw new Error('Unable to mark movie watched.');
    }
  } else if (existing) {
    if (existing.saved_at === null) {
      const { data, error } = await supabase.from('user_movie_interactions')
        .delete().eq('user_id', userId).eq('movie_id', movieId)
        .is('saved_at', null).select(FIELDS).maybeSingle();
      if (error) throw new Error('Unable to unmark movie watched.');
      if (!data) {
        const { error: updateError } = await supabase.from('user_movie_interactions')
          .update({ watched_at: null, rating: null }).eq('user_id', userId).eq('movie_id', movieId);
        if (updateError) throw new Error('Unable to unmark movie watched.');
      }
    } else {
      const { error } = await supabase.from('user_movie_interactions')
        .update({ watched_at: null, rating: null }).eq('user_id', userId).eq('movie_id', movieId);
      if (error) throw new Error('Unable to unmark movie watched.');
    }
  }
  return readUpdatedInteraction(userId, movieId);
}

export async function setMovieRating(movieId: string, rating: number): Promise<MovieInteraction> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw new Error('Invalid movie rating.');
  const userId = await currentUserId();
  const existing = await readInteraction(userId, movieId);
  if (!existing?.watched_at) throw new Error('Movie must be watched before rating.');
  const { data, error } = await supabase.from('user_movie_interactions')
    .update({ rating })
    .eq('user_id', userId).eq('movie_id', movieId)
    .not('watched_at', 'is', null)
    .select(FIELDS)
    .maybeSingle();
  if (error || !data) throw new Error('Unable to rate movie.');
  return mapRow(data as InteractionRow);
}
