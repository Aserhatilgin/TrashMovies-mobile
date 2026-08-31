import { loadImportConfig } from './config.ts';
import { normalizeGenres, normalizeMovie } from './normalize-movie.ts';
import { TmdbClient, tmdbFilterSummary } from './tmdb-client.ts';
import type {
  DryRunReport,
  RejectedMovie,
  RejectionReason,
  WriteReport,
} from './types.ts';

function sanitizeForTerminal(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();
}

function addRejectionCount(
  counts: Map<RejectionReason, number>,
  rejectedMovie: RejectedMovie,
): void {
  for (const reason of rejectedMovie.reasons) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
}

function printDiscoveryReport(report: DryRunReport, mode: 'dry-run' | 'write'): void {
  const rejectionCounts = new Map<RejectionReason, number>();
  const unknownGenreIds = new Set<number>();

  for (const rejectedMovie of report.rejectedMovies) {
    addRejectionCount(rejectionCounts, rejectedMovie);
    for (const genreId of rejectedMovie.unknownGenreIds) unknownGenreIds.add(genreId);
  }

  console.log('\nTMDB catalog import report');
  console.log(mode === 'dry-run' ? 'Mode: DRY RUN (no database writes)' : 'Mode: WRITE');
  console.log(`Requested accepted movies: ${report.requestedAcceptedCount}`);
  console.log(`Pages fetched: ${report.pagesFetched}`);
  console.log(`Candidates received: ${report.candidatesReceived}`);
  console.log(`Candidates evaluated: ${report.candidatesEvaluated}`);
  console.log(`Accepted: ${report.acceptedMovies.length}`);
  console.log(`Rejected candidates: ${report.rejectedMovies.length}`);
  console.log('Filters:', tmdbFilterSummary);

  console.log('\nRejected counts by reason:');
  if (rejectionCounts.size === 0) {
    console.log('- none');
  } else {
    for (const [reason, count] of [...rejectionCounts].sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`- ${reason}: ${count}`);
    }
  }

  if (unknownGenreIds.size > 0) {
    console.log(`Unknown TMDB genre IDs: ${[...unknownGenreIds].sort((a, b) => a - b).join(', ')}`);
  }

  console.log('\nAccepted movies:');
  for (const [index, accepted] of report.acceptedMovies.entries()) {
    const { movie, genres } = accepted;
    const genreSummary = genres.length === 0
      ? 'none'
      : genres
          .map(
            (genre) =>
              `${sanitizeForTerminal(genre.name)} (${genre.tmdb_id} -> ${genre.slug})`,
          )
          .join(', ');

    console.log(`${index + 1}. ${sanitizeForTerminal(movie.title)}`);
    console.log(`   TMDB ID: ${movie.tmdb_id}`);
    console.log(`   TMDB rating: ${movie.tmdb_rating}`);
    console.log(`   Vote count: ${movie.tmdb_vote_count}`);
    console.log(`   Release date: ${movie.release_date ?? 'unknown'}`);
    console.log(`   Genres: ${genreSummary}`);
  }

  if (mode === 'dry-run') {
    console.log('\nDry run complete. No Supabase client was created and no data was written.');
  }
}

function printWriteReport(report: WriteReport): void {
  console.log('\nSupabase synchronization report');
  console.log(`Movies synchronized: ${report.moviesSynchronized}`);
  console.log(`Genres synchronized: ${report.genresSynchronized}`);
  console.log(
    `Movie-genre relationships synchronized: ${report.movieGenreRelationshipsSynchronized}`,
  );
  console.log(`Failures: ${report.failures.length}`);

  for (const writeFailure of report.failures) {
    console.log(
      `- ${sanitizeForTerminal(writeFailure.operation)}: ${sanitizeForTerminal(writeFailure.message)}`,
    );
  }
}

async function main(): Promise<void> {
  const config = loadImportConfig(process.argv.slice(2));
  const client = new TmdbClient(config.tmdbReadAccessToken);
  const genresByTmdbId = normalizeGenres(await client.fetchMovieGenres());
  const report: DryRunReport = {
    requestedAcceptedCount: config.limit,
    pagesFetched: 0,
    candidatesReceived: 0,
    candidatesEvaluated: 0,
    acceptedMovies: [],
    rejectedMovies: [],
  };
  const seenTmdbIds = new Set<number>();
  let page = 1;
  let totalPages = 1;

  while (report.acceptedMovies.length < config.limit && page <= totalPages) {
    const discoveryPage = await client.fetchMovieCandidates(page);
    report.pagesFetched += 1;
    report.candidatesReceived += discoveryPage.results.length;
    totalPages = discoveryPage.totalPages;

    for (const candidate of discoveryPage.results) {
      if (report.acceptedMovies.length >= config.limit) break;

      report.candidatesEvaluated += 1;
      const result = normalizeMovie(candidate, genresByTmdbId);

      if (result.accepted === false) {
        report.rejectedMovies.push(result.value);
        continue;
      }

      if (seenTmdbIds.has(result.value.movie.tmdb_id)) {
        report.rejectedMovies.push({
          tmdbId: result.value.movie.tmdb_id,
          title: result.value.movie.title,
          reasons: ['duplicate_tmdb_id'],
          unknownGenreIds: [],
        });
        continue;
      }

      seenTmdbIds.add(result.value.movie.tmdb_id);
      report.acceptedMovies.push(result.value);
    }

    page += 1;
  }

  printDiscoveryReport(report, config.mode);

  if (report.acceptedMovies.length < config.limit) {
    throw new Error(
      `TMDB results were exhausted after accepting ${report.acceptedMovies.length} of ${config.limit} requested movies.`,
    );
  }

  if (config.mode === 'write') {
    let writeReport: WriteReport;

    try {
      const { SupabaseCatalogWriter } = await import('./supabase-writer.ts');
      const writer = new SupabaseCatalogWriter(
        config.supabaseUrl,
        config.supabaseServiceRoleKey,
      );
      writeReport = await writer.synchronize(report.acceptedMovies);
    } catch {
      writeReport = {
        moviesSynchronized: 0,
        genresSynchronized: 0,
        movieGenreRelationshipsSynchronized: 0,
        failures: [{
          operation: 'synchronize catalog',
          message: 'The write operation failed. No credentials or server details are shown.',
        }],
      };
    }

    printWriteReport(writeReport);

    if (writeReport.failures.length > 0) process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown importer error.';
  console.error(`TMDB catalog import failed: ${sanitizeForTerminal(message)}`);
  process.exitCode = 1;
});
