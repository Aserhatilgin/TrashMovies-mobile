import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loadDailyFixture } from './dailyMoviesFixture.ts';
import { localDailyDatabase } from './localDailyMovies.ts';

loadDailyFixture();
const { sql } = localDailyDatabase(process.argv[2]);
const result = sql(readFileSync(new URL('./personal_daily_movies.sql', import.meta.url), 'utf8'));
console.log(result);
assert.doesNotMatch(result, /^not ok/m, 'local daily movie database checks failed');
assert.match(result, /1\.\.\d+/);
