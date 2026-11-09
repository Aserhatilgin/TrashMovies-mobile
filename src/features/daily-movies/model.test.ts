import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDailyMovieFeed } from './model.ts';

const user = '10000000-0000-4000-8000-000000000001';
function raw(status = 'assigned') {
  return { user_id: user, today: '2026-11-06', status, items: [{ scheduled_date: '2026-11-06', source: 'personal',
    movie: { id: 'movie-a', title: 'Verified movie', overview: 'Details', poster_path: '/poster.jpg', tmdb_rating: 4 } }] };
}
const parse = (value: unknown) => parseDailyMovieFeed(value, user, (path) => 'poster:' + path);
test('parses the assigned personal or shared movie with server date and bounded chronological history', () => {
  const result = parse(raw());
  assert.equal(result.items[0].source, 'personal');
  assert.equal(result.items[0].movie.posterUrl, 'poster:/poster.jpg');
  const shared = raw(); shared.items[0].source = 'shared';
  assert.equal(parse(shared).items[0].source, 'shared');
});
test('candidate absence and missing shared calendar are distinct results and preserve past history', () => {
  for (const status of ['no_candidate', 'no_shared_movie']) {
    const value = raw(status); value.items[0].scheduled_date = '2026-11-05';
    assert.equal(parse(value).status, status);
    assert.equal(parse(value).items.length, 1);
    value.items = []; assert.equal(parse(value).items.length, 0);
  }
});
test('rejects a different account, contradictory status, duplicate dates, future days and invalid metadata', () => {
  assert.throws(() => parse({ ...raw(), user_id: 'other' }));
  assert.throws(() => parse({ ...raw(), status: 'query_failed' }));
  assert.throws(() => parse({ ...raw(), status: ['no_candidate'], items: [] }));
  assert.throws(() => parse({ ...raw(), items: [] }));
  assert.throws(() => parse(raw('no_candidate')));
  const duplicate = raw(); duplicate.items.push(duplicate.items[0]); assert.throws(() => parse(duplicate));
  const future = raw(); future.items[0].scheduled_date = '2026-11-07'; assert.throws(() => parse(future));
  const invalid = raw(); invalid.items[0].movie.tmdb_rating = Number.NaN; assert.throws(() => parse(invalid));
  assert.throws(() => parse({ ...raw(), today: '2026-02-31' }));
});
