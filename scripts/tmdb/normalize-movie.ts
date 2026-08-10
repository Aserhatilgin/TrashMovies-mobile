import type {
  NormalizeResult,
  NormalizedGenre,
  NormalizedMovie,
  RejectionReason,
  TmdbGenre,
  TmdbMovieCandidate,
} from './types.ts';

const MIN_TMDB_RATING = 1;
const MAX_TMDB_RATING = 5;
const MIN_VOTE_COUNT = 100;
const MIN_OVERVIEW_LENGTH = 40;

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function createSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeGenres(genres: TmdbGenre[]): Map<number, NormalizedGenre> {
  const genresByTmdbId = new Map<number, NormalizedGenre>();
  const tmdbIdBySlug = new Map<string, number>();

  for (const genre of genres) {
    const slug = createSlug(genre.name);

    if (slug === '') {
      throw new Error(`Could not generate a slug for TMDB genre ${genre.id}.`);
    }

    const existingTmdbId = tmdbIdBySlug.get(slug);
    if (existingTmdbId !== undefined && existingTmdbId !== genre.id) {
      throw new Error(`TMDB genres ${existingTmdbId} and ${genre.id} share slug "${slug}".`);
    }

    tmdbIdBySlug.set(slug, genre.id);
    genresByTmdbId.set(genre.id, {
      tmdb_id: genre.id,
      name: genre.name,
      slug,
    });
  }

  return genresByTmdbId;
}

export function normalizeMovie(
  candidate: TmdbMovieCandidate,
  genresByTmdbId: ReadonlyMap<number, NormalizedGenre>,
): NormalizeResult {
  const reasons: RejectionReason[] = [];
  const tmdbId = Number.isInteger(candidate.id) && Number(candidate.id) > 0
    ? Number(candidate.id)
    : null;
  const title = asNonBlankString(candidate.title);
  const originalTitle = asNonBlankString(candidate.original_title);
  const overview = asNonBlankString(candidate.overview);
  const posterPath = asNonBlankString(candidate.poster_path);
  const releaseDate = asNonBlankString(candidate.release_date);
  const rating = asFiniteNumber(candidate.vote_average);
  const voteCount = asFiniteNumber(candidate.vote_count);
  const popularity = asFiniteNumber(candidate.popularity);

  if (tmdbId === null) reasons.push('invalid_tmdb_id');
  if (title === null) reasons.push('invalid_title');
  if (originalTitle === null) reasons.push('invalid_original_title');
  if (overview === null || overview.length < MIN_OVERVIEW_LENGTH) reasons.push('missing_overview');
  if (posterPath === null) reasons.push('missing_poster');
  if (releaseDate !== null && !isValidDate(releaseDate)) reasons.push('invalid_release_date');
  if (rating === null || rating < MIN_TMDB_RATING || rating > MAX_TMDB_RATING) {
    reasons.push('rating_out_of_range');
  }
  if (voteCount === null || !Number.isInteger(voteCount) || voteCount < MIN_VOTE_COUNT) {
    reasons.push('insufficient_votes');
  }
  if (popularity !== null && popularity < 0) reasons.push('invalid_popularity');
  if (candidate.adult !== false) reasons.push('adult_content');

  const rawGenreIds = candidate.genre_ids;
  const hasMalformedGenreIds =
    !Array.isArray(rawGenreIds) ||
    rawGenreIds.some((genreId) => !Number.isInteger(genreId) || Number(genreId) <= 0);
  const genreIds = Array.isArray(rawGenreIds)
    ? [...new Set(
        rawGenreIds.filter(
          (genreId): genreId is number => Number.isInteger(genreId) && Number(genreId) > 0,
        ),
      )]
    : [];
  const unknownGenreIds = genreIds.filter((genreId) => !genresByTmdbId.has(genreId));

  if (hasMalformedGenreIds) reasons.push('invalid_genre_ids');
  if (unknownGenreIds.length > 0) reasons.push('unknown_genre_ids');

  if (
    reasons.length > 0 ||
    tmdbId === null ||
    title === null ||
    originalTitle === null ||
    overview === null ||
    posterPath === null ||
    rating === null ||
    voteCount === null
  ) {
    return {
      accepted: false,
      value: { tmdbId, title, reasons, unknownGenreIds },
    };
  }

  const movie: NormalizedMovie = {
    tmdb_id: tmdbId,
    title,
    original_title: originalTitle,
    overview,
    poster_path: posterPath,
    backdrop_path: asNonBlankString(candidate.backdrop_path),
    release_date: releaseDate,
    original_language: asNonBlankString(candidate.original_language),
    tmdb_rating: rating,
    tmdb_vote_count: voteCount,
    popularity: popularity !== null && popularity >= 0 ? popularity : null,
    adult: false,
  };

  return {
    accepted: true,
    value: {
      movie,
      genres: genreIds.map((genreId) => genresByTmdbId.get(genreId)!),
    },
  };
}
