import { APPROVED_MOVIE_IDS } from './onboardingV1.ts';

export interface OnboardingMovieRow {
  id: string;
  title: string;
  poster_path: string | null;
  release_date: string | null;
}

export interface OnboardingMovieSource {
  positions: () => Promise<{ position: number; movie_id: string }[]>;
  movies: (ids: readonly string[]) => Promise<OnboardingMovieRow[]>;
}

export async function loadOnboardingMovieRows(preview: boolean, source: OnboardingMovieSource): Promise<OnboardingMovieRow[]> {
  if (!preview) {
    const positions = await source.positions();
    if (positions.length !== APPROVED_MOVIE_IDS.length
      || positions.some((row, index) => row.position !== index + 1 || row.movie_id !== APPROVED_MOVIE_IDS[index])) {
      throw new Error('The V1 movie set is not configured as approved.');
    }
  }
  const rows = await source.movies(APPROVED_MOVIE_IDS);
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (rows.length !== APPROVED_MOVIE_IDS.length || byId.size !== APPROVED_MOVIE_IDS.length) {
    throw new Error('Could not load the V1 movies.');
  }
  return APPROVED_MOVIE_IDS.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error('The V1 movie catalog is incomplete.');
    return row;
  });
}
