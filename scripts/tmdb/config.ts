import type { ImportConfig } from './types.ts';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 500;

function parseLimit(argument: string): number {
  const value = argument.slice('--limit='.length);
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }

  return limit;
}

export function loadImportConfig(argumentsList: string[]): ImportConfig {
  let dryRun = false;
  let limit = DEFAULT_LIMIT;
  let hasLimit = false;

  for (const argument of argumentsList) {
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (argument.startsWith('--limit=')) {
      if (hasLimit) {
        throw new Error('--limit may only be provided once.');
      }

      limit = parseLimit(argument);
      hasLimit = true;
      continue;
    }

    throw new Error('Unsupported command-line argument.');
  }

  if (!dryRun) {
    throw new Error('Phase 1 only supports explicit --dry-run mode.');
  }

  const tmdbReadAccessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();

  if (!tmdbReadAccessToken) {
    throw new Error(
      'TMDB_READ_ACCESS_TOKEN is required. Configure it in .env.import.local.',
    );
  }

  return {
    dryRun: true,
    limit,
    tmdbReadAccessToken,
  };
}
