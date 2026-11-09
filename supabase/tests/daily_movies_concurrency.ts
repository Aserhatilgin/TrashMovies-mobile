import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { localDailyDatabase, psqlArgs, quote } from './localDailyMovies.ts';

const { sql, container } = localDailyDatabase(process.argv[2]);
interface Result { code: number | null; output: string; error: string }
function session(name: string) {
  const child = spawn('docker', ['--context', 'desktop-linux', 'exec', '-i', '-e', 'PGAPPNAME=' + name, container, ...psqlArgs]);
  let output = '', error = '';
  child.stdout.on('data', (value: Buffer) => { output += value.toString(); });
  child.stderr.on('data', (value: Buffer) => { error += value.toString(); });
  const done = new Promise<Result>((resolve, reject) => {
    child.once('error', reject); child.once('close', (code) => resolve({ code, output, error }));
  });
  return { child, done, output: () => output };
}
async function until(check: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
async function finish(promise: Promise<Result>): Promise<Result> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Concurrent session did not finish')), 12_000);
  })]); } finally { clearTimeout(timer); }
}
function payload(output: string): Record<string, unknown> {
  const line = output.split('\n').find((value) => value.startsWith('{'));
  assert.ok(line); return JSON.parse(line) as Record<string, unknown>;
}
for (const outcome of ['commit', 'rollback'] as const) {
  const userId = randomUUID();
  sql(`insert into auth.users(id,email) values (${quote(userId)},${quote('daily-concurrency-' + userId + '@example.invalid')});`);
  const nameA = 'daily_A_' + randomUUID(), nameB = 'daily_B_' + randomUUID();
  const a = session(nameA), b = session(nameB);
  const request = `begin; set local role authenticated; set local "request.jwt.claim.sub"=${quote(userId)};
    select public.get_daily_movie_feed(${quote(userId)}::uuid);\n`;
  try {
    a.child.stdin.write(request + "select 'ASSIGNMENT_LOCK_HELD';\n");
    await until(() => a.output().includes('ASSIGNMENT_LOCK_HELD'), 'first assignment did not acquire its transaction lock');
    b.child.stdin.end(request + 'commit;\n');
    await until(() => sql(`select exists(select 1 from pg_stat_activity b where b.application_name=${quote(nameB)}
      and b.wait_event_type='Lock' and (select pid from pg_stat_activity where application_name=${quote(nameA)})=any(pg_blocking_pids(b.pid)));`) === 't',
    'second first request never blocked on the first transaction');
    a.child.stdin.end(outcome + ';\n');
    const [resultA,resultB] = await Promise.all([finish(a.done),finish(b.done)]);
    assert.equal(resultA.code,0,resultA.error); assert.equal(resultB.code,0,resultB.error);
    assert.deepEqual(payload(resultA.output),payload(resultB.output),'concurrent requests return the same persisted feed');
    assert.equal(sql(`select count(*) from public.user_daily_movie_assignments where user_id=${quote(userId)};`),'1');
    console.log(JSON.stringify({ scenario: outcome, observedPostgresBlocking: true, sameReturnedFeed: true, committedAssignments: 1 }));
  } finally {
    if (!a.child.stdin.destroyed) a.child.stdin.end('rollback;\n');
    if (!b.child.stdin.destroyed) b.child.stdin.end('rollback;\n');
    await Promise.allSettled([finish(a.done),finish(b.done)]);
    sql(`delete from auth.users where id=${quote(userId)}::uuid;`);
  }
}
