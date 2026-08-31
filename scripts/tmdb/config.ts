import type { ImportConfig } from './types.ts';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 500;

function validateSupabaseServiceRoleKey(serviceRoleKey: string): void {
  if (serviceRoleKey.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY appears to contain a public credential.',
    );
  }

  const jwtParts = serviceRoleKey.split('.');
  if (jwtParts.length !== 3) return;

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(jwtParts[1], 'base64url').toString('utf8'),
    );

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'role' in payload &&
      payload.role === 'anon'
    ) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY appears to contain a public credential.',
      );
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('public credential')) {
      throw error;
    }

    // Non-decodable JWT-like values may be valid secret-key formats.
  }
}

function validateSupabaseProject(
  supabaseUrl: string,
  expectedProjectRef: string,
): void {
  if (!/^[a-z0-9]+$/.test(expectedProjectRef)) {
    throw new Error('SUPABASE_EXPECTED_PROJECT_REF has an invalid format.');
  }

  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL is not a valid URL.');
  }

  const expectedHostname = `${expectedProjectRef}.supabase.co`;
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== expectedHostname ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(
      'SUPABASE_URL does not match SUPABASE_EXPECTED_PROJECT_REF.',
    );
  }
}

function parseLimit(argument: string): number {
  const value = argument.slice('--limit='.length);
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }

  return limit;
}

export function loadImportConfig(argumentsList: string[]): ImportConfig {
  let mode: ImportConfig['mode'] | null = null;
  let limit = DEFAULT_LIMIT;
  let hasLimit = false;

  for (const argument of argumentsList) {
    if (argument === '--dry-run' || argument === '--write') {
      if (mode !== null) {
        throw new Error('Choose exactly one mode: --dry-run or --write.');
      }
      mode = argument === '--dry-run' ? 'dry-run' : 'write';
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

  if (mode === null) {
    throw new Error('Choose exactly one mode: --dry-run or --write.');
  }

  const tmdbReadAccessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();

  if (!tmdbReadAccessToken) {
    throw new Error(
      'TMDB_READ_ACCESS_TOKEN is required. Configure it in .env.import.local.',
    );
  }

  if (mode === 'dry-run') return { mode, limit, tmdbReadAccessToken };

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const expectedProjectRef = process.env.SUPABASE_EXPECTED_PROJECT_REF?.trim();

  if (!supabaseUrl || !supabaseServiceRoleKey || !expectedProjectRef) {
    throw new Error(
      'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_EXPECTED_PROJECT_REF are required in --write mode.',
    );
  }

  validateSupabaseServiceRoleKey(supabaseServiceRoleKey);
  validateSupabaseProject(supabaseUrl, expectedProjectRef);

  return {
    mode: 'write',
    limit,
    tmdbReadAccessToken,
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}
