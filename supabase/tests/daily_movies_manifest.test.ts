import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDailyFixture } from './dailyMoviesFixture.ts';

const fixture = loadDailyFixture();
test('supplied manifest has 60 consecutive dates, distinct verified UUIDs and no extra candidate films', () => {
  assert.equal(fixture.schedule.length,60);
  assert.deepEqual(new Set(fixture.schedule.map((r) => r.id)),new Set(fixture.movies.map((m) => m.id)));
});
for (const [name, likes, dislikes, expectedRemaining, expectedLiked] of [
  ['Comedy / Horror',[35],[27],34,19],
  ['Action OR Science Fiction / Horror',[28,878],[27],34,20],
  ['Drama / Romance',[18],[10749],57,2],
  ['Horror OR Thriller / Comedy',[27,53],[35],36,25],
  ['Documentary / Animation',[99],[16],60,0],
] as const) {
  test('manifest genre scenario: ' + name, () => {
    const liked = new Set(fixture.genres.filter((g) => (likes as readonly number[]).includes(g.tmdb_id)).map((g) => g.id));
    const disliked = new Set(fixture.genres.filter((g) => (dislikes as readonly number[]).includes(g.tmdb_id)).map((g) => g.id));
    const remaining = fixture.movies.filter((m) => !fixture.movie_genres.some((g) => g.movie_id === m.id && disliked.has(g.genre_id)));
    const matching = remaining.filter((m) => fixture.movie_genres.some((g) => g.movie_id === m.id && liked.has(g.genre_id)));
    assert.equal(remaining.length,expectedRemaining); assert.equal(matching.length,expectedLiked);
  });
}
