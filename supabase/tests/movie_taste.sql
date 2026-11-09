-- LOCAL Supabase only, after all migrations and the published V1 movie catalog.
-- Run with supabase test db supabase/tests/movie_taste.sql. Every fixture rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to authenticated, anon;
select no_plan();

-- Published membership is intentionally not fabricated or modified by this test.
select is((select count(*)::integer from public.onboarding_version_movies where onboarding_version = 1), 15,
  'fixture database has the published V1 set');
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'movie-taste-a@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'movie-taste-b@example.invalid');
insert into public.genres (id, tmdb_id, name, slug) values
  ('20000000-0000-4000-8000-000000000001', 2000000001, 'Taste fixture', 'taste-fixture');
insert into public.movies (id, tmdb_id, title, original_title, overview, poster_path) values
  ('30000000-0000-4000-8000-000000000001', 2000000001, 'Outside V1 fixture', 'Outside V1 fixture',
   'Movie taste integration test fixture outside the published set.', '/fixture.jpg');
insert into public.profiles (id, display_name, avatar_key)
select id, 'Unchanged identity', 'avatar_01' from auth.users
where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.user_onboarding (user_id, onboarding_version, responses, revision, started_at, completed_at, completion_source)
select id, 1, '{"display_name":"Historic answer","trash_tolerance":1}'::jsonb, 8, now(), now(), 'user'
from auth.users where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.user_preferences (user_id, age_range, gender, movie_knowledge_self_rating)
select id, '18_24', 'woman', 5 from auth.users
where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.user_recommendation_preferences (user_id, movie_priorities, watch_intents,
  trash_tolerance, discovery_level, popularity_preference, classic_openness, international_openness, runtime_preference)
select id, array['story'], array['have_fun'], 3, 4, 5, 2, 3, 'no_preference' from auth.users
where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.user_movie_preferences (user_id, movie_id, preference) values
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', -1);
insert into public.user_movie_preferences (user_id, movie_id, preference)
select '10000000-0000-4000-8000-000000000001', movie_id, 1
from public.onboarding_version_movies where onboarding_version = 1 and position = 1;
insert into public.user_movie_interactions (user_id, movie_id, saved_at, watched_at, rating) values
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', now(), now(), 8);

create temp table taste_test_payload as select jsonb_build_object(
  'liked_genres', array['20000000-0000-4000-8000-000000000001'], 'disliked_genres', '[]'::jsonb,
  'movie_priorities', array['story'], 'watch_intents', array['have_fun'], 'trash_tolerance', 4,
  'discovery_level', 4, 'popularity_preference', null, 'classic_openness', null,
  'international_openness', null, 'runtime_preference', null, 'movie_reactions', '{}'::jsonb,
  'movie_knowledge_self_rating', null) as value;
create temp table taste_test_before as select
  (select to_jsonb(p) from public.profiles p where id = '10000000-0000-4000-8000-000000000001') as identity,
  (select to_jsonb(o) from public.user_onboarding o where user_id = '10000000-0000-4000-8000-000000000001') as onboarding,
  (select to_jsonb(p) from public.user_movie_preferences p where user_id = '10000000-0000-4000-8000-000000000001'
    and movie_id = '30000000-0000-4000-8000-000000000001') as outside_reaction,
  (select to_jsonb(i) from public.user_movie_interactions i where user_id = '10000000-0000-4000-8000-000000000001') as interaction;
grant select on taste_test_payload, taste_test_before to authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(public.get_movie_taste() ->> 'revision', '0', 'initial current taste revision');
select is(public.get_movie_taste() #>> '{preferences,trash_tolerance}', '3', 'reads normalized taste instead of historic response');
select is(public.get_movie_taste() #>> '{preferences,runtime_preference}', 'no_preference', 'explicit no preference is preserved');
select throws_ok($$select public.save_movie_taste(0, '{}'::jsonb, '10000000-0000-4000-8000-000000000001')$$,
  '22023', null, 'missing required fields rejected');
select throws_ok($$select public.save_movie_taste(0, (select value ||
  '{"movie_reactions":{"30000000-0000-4000-8000-000000000001":1}}'::jsonb from taste_test_payload),
  '10000000-0000-4000-8000-000000000001')$$, '22023', null, 'server rejects out-of-V1 reaction writes');
select lives_ok($$select public.save_movie_taste(0, (select value from taste_test_payload),
  '10000000-0000-4000-8000-000000000001')$$, 'atomic taste save succeeds');
select is(public.get_movie_taste() ->> 'revision', '1', 'all taste changes increment revision once');
select ok((select to_jsonb(p) from public.user_movie_preferences p where user_id = auth.uid()
  and movie_id = '30000000-0000-4000-8000-000000000001') = (select outside_reaction from taste_test_before),
  'outside reaction including timestamps is unchanged');
select is((select count(*)::integer from public.user_movie_preferences p where p.user_id = auth.uid()
  and p.movie_id in (select movie_id from public.onboarding_version_movies where onboarding_version = 1)), 0,
  'empty reactions clear only the editable set');
select ok(public.get_movie_taste() #> '{preferences,movie_knowledge_self_rating}' = 'null'::jsonb, 'knowledge can be cleared');
select ok(public.get_movie_taste() #> '{preferences,runtime_preference}' = 'null'::jsonb, 'NULL differs from no_preference');
select ok(public.get_movie_taste() #> '{preferences,disliked_genres}' = '[]'::jsonb, 'empty list stays an empty list');
select ok((select to_jsonb(o) from public.user_onboarding o where user_id = auth.uid()) =
  (select onboarding from taste_test_before), 'onboarding responses revision and completion are unchanged');
select ok((select to_jsonb(p) from public.profiles p where id = auth.uid()) =
  (select identity from taste_test_before), 'name avatar and identity timestamps are unchanged');
select ok((select age_range = '18_24' and gender = 'woman' from public.user_preferences where user_id = auth.uid()),
  'knowledge update preserves demographics');
select ok((select to_jsonb(i) from public.user_movie_interactions i where user_id = auth.uid()) =
  (select interaction from taste_test_before), 'saved watched and rating state are unchanged');
select lives_ok($$select public.save_movie_taste(1, (select value from taste_test_payload),
  '10000000-0000-4000-8000-000000000001')$$, 'no-op save accepted');
select is(public.get_movie_taste() ->> 'revision', '1', 'no-op does not increment revision');
select lives_ok($$select public.save_movie_taste(0, (select value from taste_test_payload),
  '10000000-0000-4000-8000-000000000001')$$, 'exact lost-response retry is idempotent');
select throws_ok($$select public.save_movie_taste(0, (select value || '{"trash_tolerance":2}' from taste_test_payload),
  '10000000-0000-4000-8000-000000000001')$$, '40001', null, 'competing stale revision cannot overwrite current preferences');
select throws_ok($$select public.save_movie_taste(1, (select value from taste_test_payload),
  '10000000-0000-4000-8000-000000000002')$$, '28000', null, 'identity parameter cannot select another user');
select throws_ok($$insert into public.user_genre_preferences (user_id, genre_id, preference) values
  (auth.uid(), '20000000-0000-4000-8000-000000000001', -1)$$, '42501', null, 'direct genre write bypass is closed');
select throws_ok($$update public.user_preferences set movie_knowledge_self_rating = 8 where user_id = auth.uid()$$,
  '42501', null, 'direct knowledge write bypass is closed');
select lives_ok($$update public.user_preferences set gender = 'another_identity' where user_id = auth.uid()$$,
  'existing demographic update privilege is retained');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is(public.get_movie_taste() ->> 'user_id', '10000000-0000-4000-8000-000000000002', 'RPC reads the authenticated owner');
select is((select count(*)::integer from public.user_genre_preferences), 0, 'RLS hides the other user genres');
select is(public.get_movie_taste() ->> 'revision', '0', 'other user revision unchanged');
reset role;
set local role anon;
select throws_ok($$select public.get_movie_taste()$$, '42501', null, 'anonymous read RPC is denied');
select throws_ok($$select public.save_movie_taste(0, '{}'::jsonb, null)$$, '42501', null, 'anonymous write RPC is denied');
reset role;

-- Reject the LAST table update to prove earlier child writes are rolled back.
create function public.taste_test_force_failure() returns trigger language plpgsql as $$
begin raise exception 'forced taste failure'; end;
$$;
create trigger taste_test_force_failure before update on public.user_recommendation_preferences
for each row execute function public.taste_test_force_failure();
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
create temp table taste_test_atomic_before as select public.get_movie_taste() as value;
grant select on taste_test_atomic_before to authenticated;
set local role authenticated;
select throws_ok($$select public.save_movie_taste(1, (select value || '{"trash_tolerance":5,"movie_knowledge_self_rating":9}'
  from taste_test_payload), '10000000-0000-4000-8000-000000000001')$$,
  'P0001', 'forced taste failure', 'late error aborts the complete save');
select ok(public.get_movie_taste() = (select value from taste_test_atomic_before),
  'all four normalized domains and revision survive a failed save unchanged');
reset role;
select * from finish();
rollback;
