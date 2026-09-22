import { createClient } from '@supabase/supabase-js';

type Mode = 'dry-run' | 'write';
interface MovieRow { id: string; title: string; tmdb_id: number }
interface ScheduleRow { scheduled_date: string; movie_id: string }
interface Assignment { scheduled_date: string; movie_id: string; title: string }

function parseMode(args: string[]): Mode {
  if (args.length !== 1 || (args[0] !== '--dry-run' && args[0] !== '--write')) {
    throw new Error('Supply exactly one mode: --dry-run or --write.');
  }
  return args[0] === '--write' ? 'write' : 'dry-run';
}

function validateConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const ref = process.env.SUPABASE_EXPECTED_PROJECT_REF?.trim();
  if (!url || !key || !ref) throw new Error('Admin Supabase configuration is incomplete.');
  if (!/^[a-z0-9]+$/.test(ref)) throw new Error('Invalid expected project reference.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid Supabase URL.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== `${ref}.supabase.co` || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Supabase URL does not match the expected project.');
  }
  if (key.startsWith('sb_publishable_')) throw new Error('A public key cannot be used for this script.');
  const jwtParts = key.split('.');
  if (jwtParts.length === 3) {
    try {
      const payload: unknown = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'));
      if (typeof payload === 'object' && payload !== null && 'role' in payload && (payload.role === 'anon' || payload.role === 'authenticated')) {
        throw new Error('A public key cannot be used for this script.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('public key')) throw error;
    }
  }
  return { url, key };
}

function istanbulDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const { url, key } = validateConfig();
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const today = istanbulDate(new Date());
  const first = addDays(today, -29);
  const last = addDays(today, 30);
  const scheduleResult = await client.from('daily_movies').select('scheduled_date, movie_id').gte('scheduled_date', first).lte('scheduled_date', last);
  if (scheduleResult.error || !scheduleResult.data) throw new Error('Could not read daily movie schedule.');
  const existing = scheduleResult.data as ScheduleRow[];
  const occupied = new Set(existing.map((row) => row.scheduled_date));
  const usedMovies = new Set(existing.map((row) => row.movie_id));

  const movies: MovieRow[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await client.from('movies').select('id, title, tmdb_id').order('tmdb_id', { ascending: true }).range(from, from + 999);
    if (result.error || !result.data) throw new Error('Could not read movie candidates.');
    movies.push(...result.data as MovieRow[]);
    if (result.data.length < 1000) break;
  }
  if (movies.length === 0) throw new Error('No movie candidates are available.');

  const missing: string[] = [];
  for (let offset = -29; offset <= 30; offset += 1) {
    const date = addDays(today, offset);
    if (!occupied.has(date)) missing.push(date);
  }
  if (movies.length - usedMovies.size < missing.length) throw new Error('Not enough unused movies for unique assignments.');
  const candidates = movies.filter((movie) => !usedMovies.has(movie.id));
  const assignments: Assignment[] = missing.map((date, index) => ({
    scheduled_date: date, movie_id: candidates[index].id, title: candidates[index].title,
  }));

  console.log(`Range: ${first} through ${last}; existing: ${existing.length}; missing: ${assignments.length}`);
  for (const row of assignments) console.log(`${row.scheduled_date} -> ${row.title} (${row.movie_id})`);
  if (mode === 'dry-run') { console.log(`Dry run: ${assignments.length} proposed, 0 written.`); return; }

  let inserted = 0;
  let concurrentlyOccupied = 0;
  for (const row of assignments) {
    const result = await client.from('daily_movies').insert({ scheduled_date: row.scheduled_date, movie_id: row.movie_id });
    if (!result.error) { inserted += 1; continue; }
    if (result.error.code === '23505') {
      const current = await client.from('daily_movies').select('scheduled_date').eq('scheduled_date', row.scheduled_date).maybeSingle();
      if (!current.error && current.data) { concurrentlyOccupied += 1; continue; }
    }
    throw new Error(`Could not insert ${row.scheduled_date}; ${inserted} earlier rows were inserted.`);
  }
  console.log(`Inserted: ${inserted}; occupied concurrently: ${concurrentlyOccupied}; unchanged existing: ${existing.length}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Daily movie seeding failed.');
  process.exitCode = 1;
});
