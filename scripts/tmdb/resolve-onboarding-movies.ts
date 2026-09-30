import { TmdbClient } from './tmdb-client.ts';
import type { TmdbMovieCandidate } from './types.ts';

interface RequestedMovie {
  title: string;
  year: number;
}

interface MovieMatch {
  tmdb_id: number;
  tmdb_title: string;
  original_title: string;
  release_date: string;
}

interface Resolution {
  requested_title: string;
  requested_year: number;
  status: 'resolved' | 'ambiguous' | 'unmatched' | 'lookup_error';
  tmdb_id: number | null;
  tmdb_title: string | null;
  original_title: string | null;
  release_date: string | null;
  reason?: string;
  candidates?: MovieMatch[];
}

const REQUESTED_MOVIES: readonly RequestedMovie[] = [
  { title: 'The Dark Knight', year: 2008 },
  { title: 'Interstellar', year: 2014 },
  { title: 'The Conjuring', year: 2013 },
  { title: 'La La Land', year: 2016 },
  { title: 'The Grand Budapest Hotel', year: 2014 },
  { title: 'Parasite', year: 2019 },
  { title: 'Spirited Away', year: 2001 },
  { title: 'The Godfather', year: 1972 },
  { title: 'The Truman Show', year: 1998 },
  { title: 'Mad Max: Fury Road', year: 2015 },
  { title: 'Whiplash', year: 2014 },
  { title: 'The Notebook', year: 2004 },
  { title: 'Get Out', year: 2017 },
  { title: 'Everything Everywhere All at Once', year: 2022 },
];

const MAX_REVIEW_PAGES = 5;

function comparableTitle(title: string): string {
  return title.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\p{P}\p{S}\s]+/gu, '');
}

function titleMatches(candidate: TmdbMovieCandidate, requestedTitle: string): boolean {
  const requested = comparableTitle(requestedTitle);
  return (
    (typeof candidate.title === 'string' && comparableTitle(candidate.title) === requested) ||
    (typeof candidate.original_title === 'string' &&
      comparableTitle(candidate.original_title) === requested)
  );
}

function validMatch(candidate: TmdbMovieCandidate, year: number): MovieMatch | null {
  if (
    typeof candidate.id !== 'number' ||
    !Number.isInteger(candidate.id) ||
    candidate.id <= 0 ||
    typeof candidate.title !== 'string' ||
    candidate.title.trim() === '' ||
    typeof candidate.original_title !== 'string' ||
    candidate.original_title.trim() === '' ||
    typeof candidate.release_date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate.release_date) ||
    Number(candidate.release_date.slice(0, 4)) !== year
  ) {
    return null;
  }

  return {
    tmdb_id: candidate.id,
    tmdb_title: candidate.title,
    original_title: candidate.original_title,
    release_date: candidate.release_date,
  };
}

async function resolveMovie(client: TmdbClient, requested: RequestedMovie): Promise<Resolution> {
  const candidates: TmdbMovieCandidate[] = [];
  let totalPages = 1;

  for (let page = 1; page <= totalPages && page <= MAX_REVIEW_PAGES; page += 1) {
    const result = await client.searchMoviesByTitleAndYear(requested.title, requested.year, page);
    candidates.push(...result.results);
    totalPages = result.totalPages;
  }

  const titleCandidates = candidates.filter((candidate) => titleMatches(candidate, requested.title));
  const exactMatches = titleCandidates
    .map((candidate) => validMatch(candidate, requested.year))
    .filter((match): match is MovieMatch => match !== null);
  const base = {
    requested_title: requested.title,
    requested_year: requested.year,
  };

  if (
    exactMatches.length === 1 &&
    titleCandidates.length === 1 &&
    totalPages <= MAX_REVIEW_PAGES
  ) {
    return { ...base, status: 'resolved', ...exactMatches[0] };
  }

  const status = exactMatches.length > 1 || titleCandidates.length > 1 ||
    totalPages > MAX_REVIEW_PAGES ? 'ambiguous' : 'unmatched';
  const reviewCandidates = candidates
    .map((candidate) => validMatch(candidate, requested.year))
    .filter((match): match is MovieMatch => match !== null);

  return {
    ...base,
    status,
    tmdb_id: null,
    tmdb_title: null,
    original_title: null,
    release_date: null,
    reason: totalPages > MAX_REVIEW_PAGES
      ? `Search has more than ${MAX_REVIEW_PAGES} pages; manual review required.`
      : titleCandidates.length > exactMatches.length
        ? 'A title match has incomplete or conflicting TMDB metadata.'
        : status === 'ambiguous'
          ? 'Multiple movies match the requested title and year.'
          : 'No verified title-and-year match.',
    candidates: reviewCandidates.slice(0, 10),
  };
}

function printResolution(resolution: Resolution): void {
  // JSON escapes control characters in TMDB titles before terminal output.
  console.log(JSON.stringify(resolution).replace(/[\u007f-\u009f]/g, '?'));
}

async function main(): Promise<void> {
  if (process.argv.length !== 2) {
    throw new Error('This resolver takes no arguments. It is always read-only.');
  }

  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error('TMDB_READ_ACCESS_TOKEN is required.');
  }

  const client = new TmdbClient(token);
  const totals: Record<Resolution['status'], number> = {
    resolved: 0,
    ambiguous: 0,
    unmatched: 0,
    lookup_error: 0,
  };

  console.log('TMDB onboarding movie resolution (read-only; no Supabase client)');
  for (const requested of REQUESTED_MOVIES) {
    let resolution: Resolution;
    try {
      resolution = await resolveMovie(client, requested);
    } catch {
      resolution = {
        requested_title: requested.title,
        requested_year: requested.year,
        status: 'lookup_error',
        tmdb_id: null,
        tmdb_title: null,
        original_title: null,
        release_date: null,
        reason: 'TMDB lookup failed. No credentials or request details are shown.',
      };
    }
    totals[resolution.status] += 1;
    printResolution(resolution);
  }

  console.log(`Summary: ${JSON.stringify(totals)}`);
  if (totals.resolved !== REQUESTED_MOVIES.length) process.exitCode = 1;
}

main().catch(() => {
  console.error('TMDB movie resolution could not start. Check the token and arguments.');
  process.exitCode = 1;
});
