import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export const quote = (value: string): string => "'" + value.replaceAll("'", "''") + "'";
export const psqlArgs = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
export function localDailyDatabase(container: string | undefined) {
  assert.ok(container && /^supabase_db_trashmovies-filmzevkim-test-[a-z0-9-]+$/.test(container), 'requires the named isolated local test DB');
  const endpoint = execFileSync('docker', ['context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).trim();
  assert.ok(endpoint.startsWith('unix://'), 'remote Docker engines are forbidden');
  assert.equal(execFileSync('docker', ['--context', 'desktop-linux', 'inspect', '--format', '{{.Name}}', container], { encoding: 'utf8' }).trim(), '/' + container);
  const sql = (query: string): string => execFileSync('docker', ['--context', 'desktop-linux', 'exec', '-i', container, ...psqlArgs], {
    input: query, encoding: 'utf8', timeout: 20_000, maxBuffer: 8 * 1024 * 1024,
  }).trim();
  assert.ok(Number(sql("select current_setting('server_version_num');")) >= 170000);
  return { container, sql };
}
