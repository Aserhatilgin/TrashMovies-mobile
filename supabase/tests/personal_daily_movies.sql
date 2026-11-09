begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email)
select ('d1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  'daily-v1-' || i || '@example.invalid' from generate_series(1,9) i;
insert into public.profiles(id,display_name,avatar_key)
select id,'Local daily fixture','avatar_01' from auth.users where id between 'd1000000-0000-4000-8000-000000000001'::uuid and 'd1000000-0000-4000-8000-000000000009'::uuid;
insert into public.user_onboarding(user_id,onboarding_version,responses,revision,started_at,completed_at,completion_source)
select id,1,'{"historic":"unchanged"}',1,now(),now(),'user' from auth.users where id between 'd1000000-0000-4000-8000-000000000001'::uuid and 'd1000000-0000-4000-8000-000000000009'::uuid;
insert into public.user_recommendation_preferences(user_id,movie_priorities,watch_intents,trash_tolerance,discovery_level)
select id,array['story'],array['have_fun'],3,4 from auth.users where id between 'd1000000-0000-4000-8000-000000000001'::uuid and 'd1000000-0000-4000-8000-000000000009'::uuid;
insert into public.user_genre_preferences(user_id,genre_id,preference)
select 'd1000000-0000-4000-8000-000000000001',id,case when tmdb_id=35 then 1 else -1 end
from public.genres where tmdb_id in (35,27);
insert into public.user_genre_preferences(user_id,genre_id,preference)
select 'd1000000-0000-4000-8000-000000000002',id,case when tmdb_id=27 then 1 else -1 end
from public.genres where tmdb_id in (35,27);
insert into public.user_genre_preferences(user_id,genre_id,preference)
select 'd1000000-0000-4000-8000-000000000008',id,1 from public.genres where tmdb_id=99;

create temp table daily_results(label text primary key, payload jsonb);
grant all on daily_results to authenticated;
create function pg_temp.today_movie(p jsonb) returns uuid language sql immutable as $$
  select (item #>> '{movie,id}')::uuid from jsonb_array_elements(p->'items') item
  where item->>'scheduled_date'=p->>'today';
$$;

select is((select count(*)::integer from public.movies where daily_recommendation_eligible),60,'exactly 60 manifest candidates');
select ok(not has_function_privilege('anon','public.get_daily_movie_feed(uuid)','execute'),'anonymous execute denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.get_daily_movie_feed('d1000000-0000-4000-8000-000000000002')$$,
  '28000',null,'expected identity cannot impersonate another user');
insert into daily_results values ('A',public.get_daily_movie_feed(auth.uid()));
select is((select payload->>'status' from daily_results where label='A'),'assigned','profile A gets an assignment');
select ok(exists(select 1 from public.movie_genres mg join public.genres g on g.id=mg.genre_id
  where mg.movie_id=(select pg_temp.today_movie(payload) from daily_results where label='A') and g.tmdb_id=35),'A comedy match ranks first');
select ok(not exists(select 1 from public.movie_genres mg join public.genres g on g.id=mg.genre_id
  where mg.movie_id=(select pg_temp.today_movie(payload) from daily_results where label='A') and g.tmdb_id=27),'A has no disliked horror');
select throws_ok($$insert into public.user_daily_movie_assignments(user_id,scheduled_date,movie_id,source,preferences_revision)
  select auth.uid(),current_date,pg_temp.today_movie(payload),'personal',0 from daily_results where label='A'$$,
  '42501',null,'direct client assignment writes denied');

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
insert into daily_results values ('B',public.get_daily_movie_feed(auth.uid()));
select isnt((select pg_temp.today_movie(payload) from daily_results where label='B'),
  (select pg_temp.today_movie(payload) from daily_results where label='A'),'two incompatible tastes select different films');
select ok(exists(select 1 from public.movie_genres mg join public.genres g on g.id=mg.genre_id
  where mg.movie_id=(select pg_temp.today_movie(payload) from daily_results where label='B') and g.tmdb_id=27),'B horror match ranks first');
select ok(not exists(select 1 from public.user_daily_movie_assignments where user_id<>auth.uid()),'RLS hides other assignments');

select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.save_movie_taste(0,
  jsonb_set(jsonb_set(public.get_movie_taste()->'preferences','{liked_genres}',
    (select jsonb_agg(id) from public.genres where tmdb_id=27)), '{disliked_genres}',
    (select jsonb_agg(id) from public.genres where tmdb_id=35)), auth.uid())$$,'actual Film Zevkim update succeeds');
select is(pg_temp.today_movie(public.get_daily_movie_feed(auth.uid())),
  (select pg_temp.today_movie(payload) from daily_results where label='A'),'same-day preference change keeps the film');
select is((select preferences_revision from public.user_daily_movie_assignments where user_id=auth.uid()),0::bigint,'assignment retains original taste revision');
select is(public.get_movie_taste()->>'revision','1','current taste revision did change');

reset role;
insert into public.user_daily_movie_assignments(user_id,scheduled_date,movie_id,source,preferences_revision)
select 'd1000000-0000-4000-8000-000000000001',
  (statement_timestamp() at time zone 'Europe/Istanbul')::date-1,pg_temp.today_movie(payload),'personal',0
from daily_results where label='B';
set local role authenticated;
insert into daily_results values ('A history',public.get_daily_movie_feed(auth.uid()));
select is((select count(*)::integer from jsonb_array_elements((select payload->'items' from daily_results where label='A history')) i
  where i->>'scheduled_date'=((statement_timestamp() at time zone 'Europe/Istanbul')::date-1)::text),1,'one card per date preserves history');
select is((select (i#>>'{movie,id}')::uuid from jsonb_array_elements((select payload->'items' from daily_results where label='A history')) i
  where i->>'scheduled_date'=((statement_timestamp() at time zone 'Europe/Istanbul')::date-1)::text),
  (select pg_temp.today_movie(payload) from daily_results where label='B'),'personal history overrides shared history');

reset role;
-- Exhaust personal discovery for fallback/empty cases without real user data.
insert into public.user_movie_interactions(user_id,movie_id,watched_at)
select u.id,m.id,now() from auth.users u cross join public.movies m
where u.id in ('d1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000005')
  and m.daily_recommendation_eligible;
insert into public.user_movie_preferences(user_id,movie_id,preference)
select 'd1000000-0000-4000-8000-000000000004',movie_id,-1 from public.daily_movies
where scheduled_date=(statement_timestamp() at time zone 'Europe/Istanbul')::date;
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true);
insert into daily_results values ('fallback',public.get_daily_movie_feed(auth.uid()));
select is((select source from public.user_daily_movie_assignments where user_id=auth.uid()),'shared','watched personal pool falls back to today shared film');
select is(pg_temp.today_movie(public.get_daily_movie_feed(auth.uid())),
  (select movie_id from public.daily_movies where scheduled_date=(statement_timestamp() at time zone 'Europe/Istanbul')::date),'shared fallback is persistent');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000004',true);
insert into daily_results values ('blocked fallback',public.get_daily_movie_feed(auth.uid()));
select is((select payload->>'status' from daily_results where label='blocked fallback'),'no_candidate','explicit film dislike vetoes shared fallback');
select is((select count(*)::integer from public.user_daily_movie_assignments where user_id=auth.uid()),0,'no success record is invented for empty state');

reset role;
delete from public.user_movie_preferences where user_id='d1000000-0000-4000-8000-000000000004';
insert into public.user_genre_preferences(user_id,genre_id,preference)
select 'd1000000-0000-4000-8000-000000000004',g.genre_id,-1
from public.movie_genres g join public.daily_movies d on d.movie_id=g.movie_id
where d.scheduled_date=(statement_timestamp() at time zone 'Europe/Istanbul')::date limit 1;
set local role authenticated;
select is(public.get_daily_movie_feed(auth.uid())->>'status','no_candidate','explicit genre dislike also vetoes shared fallback');
reset role;
savepoint missing_shared;
delete from public.daily_movies where scheduled_date=(statement_timestamp() at time zone 'Europe/Istanbul')::date;
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select is(public.get_daily_movie_feed(auth.uid())->>'status','assigned','personal day works without a shared calendar row');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000005',true);
select is(public.get_daily_movie_feed(auth.uid())->>'status','no_shared_movie','missing common film is distinct from disliked fallback');
select ok(not exists(select 1 from jsonb_array_elements(public.get_daily_movie_feed(auth.uid())->'items') i
  where i->>'scheduled_date'=(statement_timestamp() at time zone 'Europe/Istanbul')::date::text),'past film never impersonates today');
rollback to missing_shared;

-- One remaining personal candidate, already assigned recently to F but 31d ago to G.
insert into public.user_movie_interactions(user_id,movie_id,watched_at)
select u.id,m.id,now() from auth.users u cross join public.movies m
where u.id in ('d1000000-0000-4000-8000-000000000006','d1000000-0000-4000-8000-000000000007')
  and m.daily_recommendation_eligible and m.tmdb_id<>17473;
insert into public.user_daily_movie_assignments(user_id,scheduled_date,movie_id,source,preferences_revision)
select u.id,(statement_timestamp() at time zone 'Europe/Istanbul')::date-
  case when u.id='d1000000-0000-4000-8000-000000000006' then 1 else 31 end,
  m.id,'personal',0 from auth.users u cross join public.movies m
where u.id in ('d1000000-0000-4000-8000-000000000006','d1000000-0000-4000-8000-000000000007') and m.tmdb_id=17473;
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000006',true);
select is((select source from jsonb_to_record(public.get_daily_movie_feed(auth.uid())) as f(items jsonb)
  cross join lateral jsonb_to_recordset(f.items) as i(scheduled_date date,source text)
  where i.scheduled_date=(statement_timestamp() at time zone 'Europe/Istanbul')::date),'shared','recent personal repeat is excluded');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000007',true);
select is(pg_temp.today_movie(public.get_daily_movie_feed(auth.uid())),(select id from public.movies where tmdb_id=17473),'31-day-old personal film may return');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000008',true);
select is(public.get_daily_movie_feed(auth.uid())->>'status','assigned','zero liked-genre matches still permits a personal film');
select is((select source from public.user_daily_movie_assignments where user_id=auth.uid()),'personal','likes are ranking signals, not hard filters');

reset role;
-- Only inside this rollback transaction: prove no taste read on an existing
-- assignment and prove a real query failure is not returned as candidate absence.
create or replace function public.get_movie_taste() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin raise exception 'Injected local read failure' using errcode='XX000'; end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select is(public.get_daily_movie_feed(auth.uid())->>'status','assigned','existing assignment does not read current taste again');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000009',true);
select throws_ok($$select public.get_daily_movie_feed(auth.uid())$$,'XX000',null,'database error propagates instead of becoming empty state');
reset role;
select * from finish();
rollback;
