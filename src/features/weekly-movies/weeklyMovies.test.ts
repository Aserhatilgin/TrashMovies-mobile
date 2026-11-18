import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';
import authReducer, { setAuth, clearAuth } from '../../store/authSlice.ts';
import weeklyReducer, { loadWeeklyMovies, type WeeklyMovieServices } from '../../store/weeklyMoviesSlice.ts';
import sharedReducer, { loadSharedDailyMovies } from '../../store/sharedDailyMoviesSlice.ts';
import type { WeeklyMovieCollection } from '../../types/weeklyMovies';
import { parseWeeklyMovieCollection } from './model.ts';
import { currentWeeklyCollection, shouldLoadWeeklyCollection } from './presentation.ts';
import { istanbulWeek } from '../../utils/istanbulWeek.ts';
import { startDailyMovieRefresh } from '../daily-movies/focusRefresh.ts';
import { deferred } from '../movie-taste/testFixtures.ts';

const A='10000000-0000-4000-8000-000000000001', B='10000000-0000-4000-8000-000000000002';
const user=(id:string):User=>({id,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:''});
function raw(count=5) { return { user_id:A,week_start:'2026-11-09',week_end:'2026-11-15',selected_on:'2026-11-12',
  preferences_revision:0,algorithm_version:1,status:count?'ready':'empty',items:Array.from({length:count},(_,i)=>({position:i+1,
    movie:{id:'movie-'+i,title:'Movie '+i,overview:'fixture',poster_path:'/fixture',tmdb_rating:4}})) }; }
const parse=(value:unknown)=>parseWeeklyMovieCollection(value,A,p=>p);
function collection(id=A,week='2026-11-09'):WeeklyMovieCollection {
  const c=parse(raw());return {...c,userId:id,weekStart:week,weekEnd:week==='2026-11-09'?'2026-11-15':'2026-11-22',selectedOn:week};
}
function harness(){
  const services:WeeklyMovieServices={fetchWeeklyMovieCollection:async id=>collection(id)};
  const shared={fetchSharedDailyMovieFeed:async(id:string)=>({userId:id,today:'2026-11-12',status:'legacy' as const,items:[]})};
  const store=configureStore({reducer:{auth:authReducer,weeklyMovies:weeklyReducer,sharedDailyMovies:sharedReducer},middleware:d=>d({thunk:{extraArgument:{...shared,...services,fetchWeeklyMovieCollection:(...args:Parameters<typeof services.fetchWeeklyMovieCollection>)=>services.fetchWeeklyMovieCollection(...args)}}})});
  store.dispatch(setAuth(user(A)));
  const load=()=>store.dispatch(loadWeeklyMovies({userId:store.getState().auth.user!.id,sessionGeneration:store.getState().auth.sessionGeneration}));
  return {store,services,load};
}
test('weekly payload accepts 0..5 films and preserves server order/metadata',()=>{
  for(let n=0;n<=5;n++){const c=parse(raw(n));assert.equal(c.items.length,n);assert.equal(c.status,n?'ready':'empty');assert.equal(c.weekStart,'2026-11-09');assert.equal(c.algorithmVersion,1);}
});
test('weekly parser rejects inconsistent dates, ownership, positions, duplicate films and unsupported versions',()=>{
  for(const patch of [{user_id:B},{week_start:'2026-11-10'},{week_end:'2026-11-16'},{selected_on:'2026-11-08'},{algorithm_version:2},{preferences_revision:-1},{status:'empty'}])assert.throws(()=>parse({...raw(),...patch}));
  assert.throws(()=>parse(raw(6)));
  const duplicate=raw();duplicate.items[1].movie.id=duplicate.items[0].movie.id;assert.throws(()=>parse(duplicate));
  const position=raw();position.items[0].position=2;assert.throws(()=>parse(position));
  const badMovie=raw();badMovie.items[0].movie.tmdb_rating=11;assert.throws(()=>parse(badMovie));
});
test('Istanbul Sunday/Monday and year boundary are independent of the host UTC day',()=>{
  assert.deepEqual(istanbulWeek(new Date('2026-11-15T20:59:59.999Z')),{start:'2026-11-09',end:'2026-11-15'});
  assert.deepEqual(istanbulWeek(new Date('2026-11-15T21:00:00Z')),{start:'2026-11-16',end:'2026-11-22'});
  assert.deepEqual(istanbulWeek(new Date('2027-01-01T10:00:00Z')),{start:'2026-12-28',end:'2027-01-03'});
});
test('late account response and same-account old session cannot restore another collection',async()=>{
  const h=harness(),pending=deferred<WeeklyMovieCollection>();h.services.fetchWeeklyMovieCollection=()=>pending.promise;
  const old=h.load();h.store.dispatch(setAuth(user(B)));pending.resolve(collection(A));await old;
  assert.equal(h.store.getState().weeklyMovies.feed,null);
  h.services.fetchWeeklyMovieCollection=async()=>collection(B);await h.load().unwrap();
  const next=deferred<WeeklyMovieCollection>();h.services.fetchWeeklyMovieCollection=()=>next.promise;
  const obsolete=h.load();h.store.dispatch(clearAuth());h.store.dispatch(setAuth(user(B)));next.resolve(collection(B));await obsolete;
  assert.equal(h.store.getState().weeklyMovies.feed,null);
});
test('same-week network error preserves collection and Home, retry restores success, partial/empty remain valid',async()=>{
  const h=harness();await h.load().unwrap();const original=h.store.getState().weeklyMovies.feed;
  h.services.fetchWeeklyMovieCollection=async()=>{throw Error('offline');};await assert.rejects(h.load().unwrap());
  assert.equal(h.store.getState().weeklyMovies.hasError,true);assert.deepEqual(currentWeeklyCollection(h.store.getState().weeklyMovies.feed,'2026-11-09'),original);
  await h.store.dispatch(loadSharedDailyMovies({userId:A,sessionGeneration:h.store.getState().auth.sessionGeneration})).unwrap();
  assert.equal(h.store.getState().sharedDailyMovies.feed?.status,'legacy');assert.deepEqual(h.store.getState().weeklyMovies.feed,original);
  for(const n of [2,0]){h.services.fetchWeeklyMovieCollection=async()=>parse(raw(n));await h.load().unwrap();assert.equal(h.store.getState().weeklyMovies.feed?.items.length,n);assert.equal(h.store.getState().weeklyMovies.hasError,false);}
});
test('Sunday-to-Monday refresh hides old package before network failure; successful retry shows the new week',async(t)=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:new Date('2026-11-15T20:59:59.999Z')});
  const h=harness();let week='',requests:ReturnType<typeof h.load>[]=[];
  const stop=startDailyMovieRefresh({load:()=>{const r=h.load();requests.push(r);return r;},onDateChange:()=>{week=istanbulWeek(new Date()).start;},subscribeActive:()=>()=>{}});t.after(stop);
  await requests[0].unwrap();const original=h.store.getState().weeklyMovies.feed;
  assert.equal(currentWeeklyCollection(original,week)?.items.length,5);
  h.services.fetchWeeklyMovieCollection=async()=>{throw Error('offline');};t.mock.timers.tick(1);
  assert.equal(week,'2026-11-16');assert.equal(currentWeeklyCollection(h.store.getState().weeklyMovies.feed,week),null);
  await assert.rejects(requests[1].unwrap());assert.equal(h.store.getState().weeklyMovies.hasError,true);assert.deepEqual(h.store.getState().weeklyMovies.feed,original);
  h.services.fetchWeeklyMovieCollection=async()=>collection(A,'2026-11-16');await h.load().unwrap();
  assert.equal(currentWeeklyCollection(h.store.getState().weeklyMovies.feed,week)?.weekStart,'2026-11-16');assert.equal(h.store.getState().weeklyMovies.hasError,false);
});
test('a new day within the same week keeps the weekly collection visible',()=>{
  const c=collection();for(const date of ['2026-11-09T10:00:00Z','2026-11-12T10:00:00Z','2026-11-15T20:59:00Z'])assert.equal(currentWeeklyCollection(c,istanbulWeek(new Date(date)).start),c);
});

test('real focus cache decision skips same-week focus/foreground/day changes, refreshes next week and stops after blur',async(t)=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:new Date('2026-11-12T10:00:00Z')});
  const h=harness();await h.load().unwrap();let calls=0;let foreground=()=>{};
  h.services.fetchWeeklyMovieCollection=async()=>{calls++;return collection(A,'2026-11-16');};
  const stop=startDailyMovieRefresh({load:()=>{const state=h.store.getState();return shouldLoadWeeklyCollection(state.weeklyMovies,A,state.auth.sessionGeneration,istanbulWeek(new Date()).start)?h.load():null;},onDateChange:()=>{},subscribeActive:fn=>{foreground=fn;return()=>{};}});
  t.after(stop);foreground();t.mock.timers.tick(24*60*60*1000);foreground();assert.equal(calls,0);
  t.mock.timers.setTime(new Date('2026-11-15T20:59:59.999Z').getTime());t.mock.timers.tick(60_000);
  await new Promise<void>(resolve=>queueMicrotask(resolve));assert.equal(calls,1);
  stop();foreground();t.mock.timers.tick(8*24*60*60*1000);assert.equal(calls,1);
});
