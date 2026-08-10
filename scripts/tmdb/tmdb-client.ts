import type {
  TmdbDiscoverPage,
  TmdbGenre,
  TmdbMovieCandidate,
} from './types.ts';

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_LANGUAGE = 'en-US';
const MIN_TMDB_RATING = 1;
const MAX_TMDB_RATING = 5;
const MIN_VOTE_COUNT = 100;
const MIN_RUNTIME_MINUTES = 60;
const MAX_RETRIES = 3;
const MAX_TMDB_PAGE = 500;
const REQUEST_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function releaseDateCutoff(): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  return cutoff.toISOString().slice(0, 10);
}

export class TmdbClient {
  constructor(private readonly readAccessToken: string) {}

  private async get(path: string, searchParams?: URLSearchParams): Promise<unknown> {
    const url = new URL(`${TMDB_API_BASE_URL}${path}`);

    if (searchParams) {
      url.search = searchParams.toString();
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      let response: Response;

      try {
        response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.readAccessToken}`,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        if (attempt === MAX_RETRIES) {
          throw new Error(
            `TMDB request failed after ${MAX_RETRIES} attempts or exceeded the ${REQUEST_TIMEOUT_MS}ms timeout.`,
          );
        }

        await wait(500 * 2 ** (attempt - 1));
        continue;
      }

      if (response.ok) {
        return response.json() as Promise<unknown>;
      }

      const shouldRetry = response.status === 429 || response.status >= 500;

      if (!shouldRetry || attempt === MAX_RETRIES) {
        throw new Error(`TMDB request failed with HTTP ${response.status}.`);
      }

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader === null ? null : Number(retryAfterHeader);
      const retryDelay =
        retryAfterSeconds !== null &&
        Number.isFinite(retryAfterSeconds) &&
        retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : 500 * 2 ** (attempt - 1);

      await wait(retryDelay);
    }

    throw new Error('TMDB request failed after all retry attempts.');
  }

  async fetchMovieGenres(): Promise<TmdbGenre[]> {
    const payload = await this.get(
      '/genre/movie/list',
      new URLSearchParams({ language: TMDB_LANGUAGE }),
    );

    if (!isRecord(payload) || !Array.isArray(payload.genres)) {
      throw new Error('TMDB returned an invalid movie genre response.');
    }

    return payload.genres.map((genre) => {
      if (
        !isRecord(genre) ||
        !Number.isInteger(genre.id) ||
        typeof genre.name !== 'string' ||
        genre.name.trim() === ''
      ) {
        throw new Error('TMDB returned an invalid genre entry.');
      }

      return { id: genre.id as number, name: genre.name.trim() };
    });
  }

  async fetchMovieCandidates(page: number): Promise<TmdbDiscoverPage> {
    if (!Number.isInteger(page) || page < 1 || page > MAX_TMDB_PAGE) {
      throw new Error(`TMDB page must be between 1 and ${MAX_TMDB_PAGE}.`);
    }

    const payload = await this.get(
      '/discover/movie',
      new URLSearchParams({
        include_adult: 'false',
        include_video: 'false',
        language: TMDB_LANGUAGE,
        page: String(page),
        'primary_release_date.lte': releaseDateCutoff(),
        sort_by: 'vote_count.desc',
        'vote_average.gte': String(MIN_TMDB_RATING),
        'vote_average.lte': String(MAX_TMDB_RATING),
        'vote_count.gte': String(MIN_VOTE_COUNT),
        'with_runtime.gte': String(MIN_RUNTIME_MINUTES),
      }),
    );

    if (
      !isRecord(payload) ||
      !Number.isInteger(payload.page) ||
      !Number.isInteger(payload.total_pages) ||
      !Array.isArray(payload.results)
    ) {
      throw new Error('TMDB returned an invalid movie discovery response.');
    }

    return {
      page: payload.page as number,
      totalPages: Math.min(payload.total_pages as number, MAX_TMDB_PAGE),
      results: payload.results.map((result): TmdbMovieCandidate =>
        isRecord(result) ? result : {},
      ),
    };
  }
}

export const tmdbFilterSummary = {
  adultContent: 'excluded',
  maximumRating: MAX_TMDB_RATING,
  minimumRating: MIN_TMDB_RATING,
  minimumRuntimeMinutes: MIN_RUNTIME_MINUTES,
  minimumVoteCount: MIN_VOTE_COUNT,
  releaseDateCutoffDays: 90,
} as const;
