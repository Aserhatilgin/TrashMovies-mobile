import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import type { MovieTasteValues } from '../../src/types/movieTaste';

// Deliberately cannot target a company container, the app's normal stack, a URL,
// or a hosted database. All SQL runs through this named local Docker container.
const container = process.argv[2];
if (!container || !/^supabase_db_trashmovies-filmzevkim-test-[a-z0-9-]+$/.test(container)) {
  throw new Error('Pass the dedicated supabase_db_trashmovies-filmzevkim-test-… container name.');
}
const dockerArgs = ['--context', 'desktop-linux'];
const dockerEndpoint = execFileSync('docker', ['context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).trim();
assert.ok(dockerEndpoint.startsWith('unix://'), 'requires a local Docker socket, not a remote engine');
const psqlArgs = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
const quote = (value: string): string => "'" + value.replaceAll("'", "''") + "'";
function sql(query: string): string {
  return execFileSync('docker', [...dockerArgs, 'exec', '-i', container, ...psqlArgs], {
    input: query, encoding: 'utf8', timeout: 15000,
  }).trim();
}
const inspectedName = execFileSync('docker', [...dockerArgs, 'inspect', '--format', '{{.Name}}', container], { encoding: 'utf8' }).trim();
assert.equal(inspectedName, '/' + container);
const serverVersion = Number(sql("select current_setting('server_version_num');"));
assert.ok(serverVersion >= 170000 && serverVersion < 180000, 'requires the disposable PostgreSQL 17 stack');
assert.equal(sql('select count(*) from public.onboarding_version_movies where onboarding_version=1;'), '15');

interface SessionResult { code: number | null; output: string; error: string }
function session(applicationName: string) {
  const child = spawn('docker', [...dockerArgs, 'exec', '-i', '-e', 'PGAPPNAME=' + applicationName, container, ...psqlArgs]);
  let output = '', error = '';
  child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
  child.stderr.on('data', (data: Buffer) => { error += data.toString(); });
  const done = new Promise<SessionResult>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, output, error }));
  });
  return { child, done, output: () => output };
}
async function until(check: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out: ' + description);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
async function completed(promise: Promise<SessionResult>): Promise<SessionResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Session did not finish')), 10000);
    })]);
  } finally { clearTimeout(timer); }
}
function auth(userId: string): string {
  return `begin; set local role authenticated; set local "request.jwt.claim.sub" = ${quote(userId)};\n`;
}
function save(userId: string, values: MovieTasteValues): string {
  return `select public.save_movie_taste(0, ${quote(JSON.stringify(values))}::jsonb, ${quote(userId)}::uuid)->>'revision';\n`;
}
function readTaste(userId: string): { revision: number; preferences: MovieTasteValues } {
  const value = sql(auth(userId) + 'select public.get_movie_taste(); rollback;');
  return JSON.parse(value) as { revision: number; preferences: MovieTasteValues };
}
function protectedRows(userId: string, outsideId: string): string {
  return sql(`select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where id=${quote(userId)}::uuid),
    'onboarding', (select to_jsonb(o) from public.user_onboarding o where user_id=${quote(userId)}::uuid),
    'outside', (select to_jsonb(p) from public.user_movie_preferences p where user_id=${quote(userId)}::uuid and movie_id=${quote(outsideId)}::uuid),
    'demographics', (select jsonb_build_object('age',age_range,'gender',gender) from public.user_preferences where user_id=${quote(userId)}::uuid));`);
}

async function scenario(endA: 'commit' | 'rollback'): Promise<void> {
  const userId = randomUUID(), genreA = randomUUID(), genreB = randomUUID(), outsideId = randomUUID();
  const tmdbId = 2100000000 + randomInt(1000000);
  const curatedId = sql('select movie_id from public.onboarding_version_movies where onboarding_version=1 order by position limit 1;');
  const valueA: MovieTasteValues = {
    liked_genres: [genreA], disliked_genres: [genreB], movie_priorities: ['absurdity', 'story'],
    watch_intents: ['embrace_absurdity', 'have_fun'], trash_tolerance: 4, discovery_level: 4,
    popularity_preference: null, classic_openness: 3, international_openness: 4,
    runtime_preference: 'no_preference', movie_reactions: { [curatedId]: 1 }, movie_knowledge_self_rating: 7,
  };
  const valueB: MovieTasteValues = {
    liked_genres: [genreB], disliked_genres: [genreA], movie_priorities: ['music'], watch_intents: ['relax'],
    trash_tolerance: 5, discovery_level: 2, popularity_preference: 5, classic_openness: null,
    international_openness: null, runtime_preference: null, movie_reactions: { [curatedId]: -1 }, movie_knowledge_self_rating: 2,
  };
  sql(`begin;
    insert into auth.users(id,email) values (${quote(userId)},${quote('taste-concurrency-' + userId + '@example.invalid')});
    insert into public.profiles(id,display_name,avatar_key) values (${quote(userId)},'Concurrent fixture','avatar_01');
    insert into public.genres(id,tmdb_id,name,slug) values
      (${quote(genreA)},${tmdbId},'Concurrent A',${quote('concurrent-a-' + genreA)}),
      (${quote(genreB)},${tmdbId + 1},'Concurrent B',${quote('concurrent-b-' + genreB)});
    insert into public.movies(id,tmdb_id,title,original_title,overview,poster_path) values
      (${quote(outsideId)},${tmdbId},'Outside fixture','Outside fixture','Disposable concurrent movie taste fixture.','/fixture.jpg');
    insert into public.user_onboarding(user_id,onboarding_version,responses,revision,started_at,completed_at,completion_source)
      values (${quote(userId)},1,'{"historic":true}',8,now(),now(),'user');
    insert into public.user_preferences(user_id,age_range,gender,movie_knowledge_self_rating)
      values (${quote(userId)},'18_24','woman',5);
    insert into public.user_recommendation_preferences(user_id,movie_priorities,watch_intents,trash_tolerance,discovery_level)
      values (${quote(userId)},array['story'],array['have_fun'],3,3);
    insert into public.user_movie_preferences(user_id,movie_id,preference) values (${quote(userId)},${quote(outsideId)},-1);
    commit;`);
  const beforeProtected = protectedRows(userId, outsideId);
  const appA = 'movie_taste_A_' + randomUUID(), appB = 'movie_taste_B_' + randomUUID();
  const a = session(appA), b = session(appB);
  try {
    a.child.stdin.write(auth(userId) + save(userId, valueA) + "select 'A_LOCK_HELD';\n");
    await until(() => a.output().includes('A_LOCK_HELD'), 'A saved while holding its transaction');
    b.child.stdin.end('\\set VERBOSITY verbose\n' + auth(userId) + save(userId, valueB) + 'commit;\n');
    // Observe the actual lock relationship, not a timing assumption or a mock.
    await until(() => sql(`select exists(select 1 from pg_stat_activity b
      where b.application_name=${quote(appB)} and b.wait_event_type='Lock'
        and (select pid from pg_stat_activity where application_name=${quote(appA)})=any(pg_blocking_pids(b.pid)));`) === 't',
    'B is blocked by A in PostgreSQL');
    a.child.stdin.end(endA + ';\n');
    const resultA = await completed(a.done), resultB = await completed(b.done);
    assert.equal(resultA.code, 0, resultA.error);
    if (endA === 'commit') {
      assert.notEqual(resultB.code, 0, 'stale writer B must be rejected');
      assert.match(resultB.error, /40001.*Taste revision conflict/);
    } else {
      assert.equal(resultB.code, 0, resultB.error);
      assert.match(resultB.output, /\b1\b/);
    }
    const winner = endA === 'commit' ? valueA : valueB;
    const current = readTaste(userId);
    assert.equal(current.revision, 1, 'exactly one committed taste generation');
    assert.deepEqual(current.preferences, { ...winner, movie_reactions: { ...winner.movie_reactions, [outsideId]: -1 } });
    assert.equal(protectedRows(userId, outsideId), beforeProtected, 'historic identity/onboarding/demographics/outside reactions unchanged');
    console.log(JSON.stringify({ scenario: endA.toUpperCase(), observedBlocking: true,
      sessionA: endA.toUpperCase(), sessionB: endA === 'commit' ? '40001' : 'COMMIT',
      revision: current.revision, completeWinnerSnapshot: true, protectedRowsUnchanged: true }));
  } finally {
    if (!a.child.stdin.destroyed) a.child.stdin.end('rollback;\n');
    if (!b.child.stdin.destroyed) b.child.stdin.end('rollback;\n');
    await Promise.allSettled([completed(a.done), completed(b.done)]);
    // Only fixture IDs created by this invocation, inside the dedicated container.
    sql(`begin; delete from auth.users where id=${quote(userId)}::uuid;
      delete from public.movies where id=${quote(outsideId)}::uuid;
      delete from public.genres where id in (${quote(genreA)}::uuid,${quote(genreB)}::uuid); commit;`);
  }
}

await scenario('commit');
await scenario('rollback');
