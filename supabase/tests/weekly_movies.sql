begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temp table protected_shared as select * from public.daily_movies;
create temp table protected_daily as select * from public.user_daily_movie_assignments;
create temp table protected_taste as select pg_get_functiondef('public.get_movie_taste()'::regprocedure) definition;
create temp table protected_rpc as select pg_get_functiondef('public.get_daily_movie_feed(uuid)'::regprocedure) definition;
create or replace function private.weekly_movie_today() returns date language sql stable set search_path='' as $$ select date '2026-11-15' $$;
insert into auth.users(id,email) select ('e7120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'weekly-test-'||i||'@example.invalid' from generate_series(1,10)i;
insert into public.profiles(id,display_name,avatar_key) select id,'Local weekly fixture','avatar_01' from auth.users where id::text like 'e7120000-%';
insert into public.user_onboarding(user_id,onboarding_version,responses,revision,started_at,completed_at,completion_source)
 select id,1,'{"historic":"unchanged"}',1,now(),now(),'user' from auth.users where id::text like 'e7120000-%';
insert into public.user_recommendation_preferences(user_id,movie_priorities,watch_intents,trash_tolerance,discovery_level)
 select id,array['story'],array['have_fun'],3,4 from auth.users where id::text like 'e7120000-%';
insert into public.user_genre_preferences(user_id,genre_id,preference)
 select 'e7120000-0000-4000-8000-000000000001',id,case when tmdb_id=35 then 1 else -1 end from public.genres where tmdb_id in(35,27);
insert into public.user_genre_preferences(user_id,genre_id,preference)
 select 'e7120000-0000-4000-8000-000000000002',id,case when tmdb_id=27 then 1 else -1 end from public.genres where tmdb_id in(35,27);
create temp table weekly_results(label text primary key,payload jsonb);
grant all on weekly_results to authenticated;
create function pg_temp.ids(p jsonb) returns uuid[] language sql immutable as $$ select coalesce(array_agg((i#>>'{movie,id}')::uuid order by (i->>'position')::int),'{}'::uuid[]) from jsonb_array_elements(p->'items')i $$;
select is((select count(*)::int from public.movies where daily_recommendation_eligible),60,'approved 60 film pool');
select ok(not has_function_privilege('anon','public.get_weekly_movie_collection(uuid)','execute'),'anonymous RPC denied');
select ok(not has_function_privilege('authenticated','private.weekly_movie_today()','execute'),'API cannot invoke private clock');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_weekly_movie_collection(null)$$,'28000',null,'missing identity rejected');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.get_weekly_movie_collection('e7120000-0000-4000-8000-000000000002')$$,'28000',null,'impersonation rejected');
insert into weekly_results values('A',public.get_weekly_movie_collection(auth.uid()));
select is((select jsonb_array_length(payload->'items') from weekly_results where label='A'),5,'first collection has five films');
select is((select payload->>'week_start' from weekly_results where label='A'),'2026-11-09','Sunday belongs to previous Monday');
select is((select payload->>'week_end' from weekly_results where label='A'),'2026-11-15','week ends Sunday');
select is((select payload->>'selected_on' from weekly_results where label='A'),'2026-11-15','records actual exposure date');
select is((select payload->>'algorithm_version' from weekly_results where label='A'),'1','algorithm version recorded');
select is((select payload->>'preferences_revision' from weekly_results where label='A'),'0','normalized taste revision recorded');
select is((select count(distinct movie_id)::int from public.user_weekly_movie_items),5,'five distinct films');
select is((select array_agg(position::int order by position) from public.user_weekly_movie_items),array[1,2,3,4,5],'stable contiguous positions');
select ok(not exists(select 1 from public.user_weekly_movie_items i join public.movie_genres mg on mg.movie_id=i.movie_id join public.genres g on g.id=mg.genre_id where g.tmdb_id=27),'disliked genre excluded');
select is((select count(*)::int from public.user_weekly_movie_items i where exists(select 1 from public.movie_genres mg join public.genres g on g.id=mg.genre_id where mg.movie_id=i.movie_id and g.tmdb_id=35)),5,'liked genres rank first');
select is(public.get_weekly_movie_collection(auth.uid()),(select payload from weekly_results where label='A'),'repeat call returns identical package');
select lives_ok($$select public.save_movie_taste(0,jsonb_set(jsonb_set(public.get_movie_taste()->'preferences','{liked_genres}',(select jsonb_agg(id) from public.genres where tmdb_id=27)),'{disliked_genres}',(select jsonb_agg(id) from public.genres where tmdb_id=35)),auth.uid())$$,'canonical preference update works');
select is(public.get_movie_taste()->>'revision','1','taste revision really changes');
select is(public.get_weekly_movie_collection(auth.uid()),(select payload from weekly_results where label='A'),'same-week change cannot reroll or alter captured revision');
select throws_ok($$insert into public.user_weekly_movie_collections values(auth.uid(),'2026-11-16','2026-11-16',0,1,now())$$,'42501',null,'direct header insert denied');
select throws_ok($$update public.user_weekly_movie_items set position=position$$,'42501',null,'direct item update denied');
select throws_ok($$delete from public.user_weekly_movie_collections$$,'42501',null,'direct header delete denied');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.user_weekly_movie_items),0,'RLS hides other users films');
select is((select count(*)::int from public.user_weekly_movie_collections),0,'RLS hides other users headers');
insert into weekly_results values('B',public.get_weekly_movie_collection(auth.uid()));
select ok(not (select pg_temp.ids(payload) from weekly_results where label='A') && (select pg_temp.ids(payload) from weekly_results where label='B'),'incompatible tastes produce disjoint collections');
reset role;
-- C/D have exactly one unwatched film: actual exposure 31/30 days ago.
insert into public.user_movie_interactions(user_id,movie_id,watched_at)
select u.id,m.id,now() from auth.users u cross join public.movies m where u.id in('e7120000-0000-4000-8000-000000000003','e7120000-0000-4000-8000-000000000004','e7120000-0000-4000-8000-000000000005') and m.daily_recommendation_eligible and m.tmdb_id<>17473;
insert into public.user_weekly_movie_collections(user_id,week_start,selected_on,preferences_revision)
values('e7120000-0000-4000-8000-000000000003','2026-10-12','2026-10-15',0),('e7120000-0000-4000-8000-000000000004','2026-10-12','2026-10-16',0);
insert into public.user_weekly_movie_items(user_id,week_start,position,movie_id)
select u.id,'2026-10-12',1,m.id from auth.users u cross join public.movies m where u.id in('e7120000-0000-4000-8000-000000000003','e7120000-0000-4000-8000-000000000004') and m.tmdb_id=17473;
insert into public.user_daily_movie_assignments(user_id,scheduled_date,movie_id,source,preferences_revision)
select 'e7120000-0000-4000-8000-000000000005','2026-11-15',id,'personal',0 from public.movies where tmdb_id=17473;
-- F exactly two candidates, G zero. H explicit film dislike vetoes its only candidate.
insert into public.user_movie_interactions(user_id,movie_id,watched_at)
select u.id,m.id,now() from auth.users u cross join public.movies m where m.daily_recommendation_eligible and (
(u.id='e7120000-0000-4000-8000-000000000006' and m.id not in(select id from public.movies where daily_recommendation_eligible order by id limit 2)) or
u.id='e7120000-0000-4000-8000-000000000007' or
(u.id='e7120000-0000-4000-8000-000000000008' and m.tmdb_id<>17473));
insert into public.user_movie_preferences(user_id,movie_id,preference) select 'e7120000-0000-4000-8000-000000000008',id,-1 from public.movies where tmdb_id=17473;
set local role authenticated;
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000003',true);
select is(jsonb_array_length(public.get_weekly_movie_collection(auth.uid())->'items'),1,'31 day old exposure allowed');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000004',true);
select is(jsonb_array_length(public.get_weekly_movie_collection(auth.uid())->'items'),0,'30 day actual exposure excluded despite older week start');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000005',true);
select is(jsonb_array_length(public.get_weekly_movie_collection(auth.uid())->'items'),0,'legacy personal film assigned today excluded');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000006',true);
select is(jsonb_array_length(public.get_weekly_movie_collection(auth.uid())->'items'),2,'two eligible films returned without padding');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000007',true);
insert into weekly_results values('empty',public.get_weekly_movie_collection(auth.uid()));
select is((select payload->>'status' from weekly_results where label='empty'),'empty','zero candidates distinguished from error');
select is((select count(*)::int from public.user_weekly_movie_collections where user_id=auth.uid()),1,'empty collection is persisted');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000008',true);
select is(jsonb_array_length(public.get_weekly_movie_collection(auth.uid())->'items'),0,'explicit negative film excluded; no shared fallback');
reset role;
delete from public.user_movie_interactions where user_id='e7120000-0000-4000-8000-000000000007';
create or replace function public.get_movie_taste() returns jsonb language plpgsql security definer set search_path='' as $$ begin raise exception 'Injected taste query failure' using errcode='XX000'; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000007',true);
select is(public.get_weekly_movie_collection(auth.uid()),(select payload from weekly_results where label='empty'),'empty header stays immutable and does not reread taste');
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000009',true);
select throws_ok($$select public.get_weekly_movie_collection(auth.uid())$$,'XX000','Injected taste query failure','query error is not empty success');
select is((select count(*)::int from public.user_weekly_movie_collections where user_id=auth.uid()),0,'failed query persists no header');
reset role;
-- Restore exact original taste function from saved catalog definition, without permanent changes.
do $$ begin execute (select definition from protected_taste); end $$;
create function pg_temp.reject_item() returns trigger language plpgsql as $$ begin if new.position=3 then raise exception 'Injected item write failure' using errcode='XX000'; end if; return new; end $$;
create trigger weekly_test_failure before insert on public.user_weekly_movie_items for each row execute function pg_temp.reject_item();
set local role authenticated;
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000009',true);
select throws_ok($$select public.get_weekly_movie_collection(auth.uid())$$,'XX000','Injected item write failure','failure midway through items propagates');
select is((select count(*)::int from public.user_weekly_movie_collections where user_id=auth.uid()),0,'partial item failure rolls header back');
select is((select count(*)::int from public.user_weekly_movie_items where user_id=auth.uid()),0,'partial item failure rolls all items back');
reset role;
drop trigger weekly_test_failure on public.user_weekly_movie_items;
set local role authenticated;
select is(jsonb_array_length(public.get_weekly_movie_collection(auth.uid())->'items'),5,'successful retry after failure persists full collection');
reset role;
savepoint adult_veto;
insert into public.user_movie_interactions(user_id,movie_id,watched_at)
select 'e7120000-0000-4000-8000-000000000010',id,now() from public.movies where daily_recommendation_eligible and tmdb_id<>17473;
update public.movies set adult=true where tmdb_id=17473;
set local role authenticated;
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000010',true);
select is(jsonb_array_length(public.get_weekly_movie_collection(auth.uid())->'items'),0,'adult veto excludes the only unwatched candidate');
reset role;
rollback to adult_veto;
create or replace function private.weekly_movie_today() returns date language sql stable set search_path='' as $$ select date '2026-11-16' $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','e7120000-0000-4000-8000-000000000001',true);
insert into weekly_results values('Monday',public.get_weekly_movie_collection(auth.uid()));
select is((select payload->>'week_start' from weekly_results where label='Monday'),'2026-11-16','Monday creates a new week');
select is((select payload->>'preferences_revision' from weekly_results where label='Monday'),'1','new week reads latest normalized preference revision');
select ok(not (select pg_temp.ids(payload) from weekly_results where label='A') && (select pg_temp.ids(payload) from weekly_results where label='Monday'),'new week excludes previous collection');
select is((select count(*)::int from public.user_weekly_movie_collections where user_id=auth.uid()),2,'previous weekly snapshot preserved');
select ok(not exists(select 1 from public.user_weekly_movie_items i join public.movie_genres mg on mg.movie_id=i.movie_id join public.genres g on g.id=mg.genre_id where i.week_start='2026-11-16' and g.tmdb_id=35),'new week applies changed explicit dislike');
reset role;
select is((select jsonb_agg(to_jsonb(t) order by t.scheduled_date) from public.daily_movies t),(select jsonb_agg(to_jsonb(t) order by t.scheduled_date) from protected_shared t),'entire shared calendar is byte-equivalent');
select is((select jsonb_agg(to_jsonb(t) order by t.user_id,t.scheduled_date) from public.user_daily_movie_assignments t where t.user_id::text not like 'e7120000-%'),(select jsonb_agg(to_jsonb(t) order by t.user_id,t.scheduled_date) from protected_daily t),'all previous daily assignments preserved');
select is(pg_get_functiondef('public.get_daily_movie_feed(uuid)'::regprocedure),(select definition from protected_rpc),'legacy daily RPC definition unchanged');
select is((select count(*)::int from public.user_daily_movie_assignments where user_id::text like 'e7120000-%'),1,'weekly RPC never creates legacy daily assignments');
select ok(exists(select 1 from public.user_daily_movie_assignments a join public.movies m on m.id=a.movie_id where a.user_id='e7120000-0000-4000-8000-000000000005' and a.scheduled_date='2026-11-15' and a.source='personal' and m.tmdb_id=17473),'the only synthetic daily row is the unchanged explicit fixture');
select * from finish();
rollback;
