-- These private parsers reject wrong JSON types and duplicate selections before
-- any normalized row is written. They are callable only inside the definer RPC.
create function private.onboarding_v1_text_choices(
  p_value jsonb, p_allowed text[], p_min integer, p_max integer
)
returns text[]
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  element jsonb;
  choice text;
  choices text[] := array[]::text[];
begin
  if jsonb_typeof(p_value) is distinct from 'array' then
    raise exception 'Invalid V1 choice array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_value) not between p_min and p_max then
    raise exception 'Invalid V1 choice array' using errcode = '22023';
  end if;
  for element in select value from jsonb_array_elements(p_value) as item(value) loop
    if jsonb_typeof(element) is distinct from 'string' then
      raise exception 'V1 choices must be strings' using errcode = '22023';
    end if;
    choice := element #>> '{}';
    if not (choice = any(p_allowed)) or choice = any(choices) then
      raise exception 'Unknown or repeated V1 choice' using errcode = '22023';
    end if;
    choices := array_append(choices, choice);
  end loop;
  return choices;
end;
$$;

revoke all on function private.onboarding_v1_text_choices(jsonb, text[], integer, integer)
  from public, anon, authenticated, service_role;

create function private.onboarding_v1_uuid_choices(
  p_value jsonb, p_min integer, p_max integer
)
returns uuid[]
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  element jsonb;
  choice_text text;
  choice uuid;
  choices uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(p_value) is distinct from 'array' then
    raise exception 'Invalid V1 UUID array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_value) not between p_min and p_max then
    raise exception 'Invalid V1 UUID array' using errcode = '22023';
  end if;
  for element in select value from jsonb_array_elements(p_value) as item(value) loop
    if jsonb_typeof(element) is distinct from 'string' then
      raise exception 'V1 IDs must be strings' using errcode = '22023';
    end if;
    choice_text := element #>> '{}';
    if choice_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid V1 UUID' using errcode = '22023';
    end if;
    choice := choice_text::uuid;
    if choice = any(choices) then
      raise exception 'Repeated V1 UUID' using errcode = '22023';
    end if;
    choices := array_append(choices, choice);
  end loop;
  return choices;
end;
$$;

revoke all on function private.onboarding_v1_uuid_choices(jsonb, integer, integer)
  from public, anon, authenticated, service_role;

create function private.onboarding_v1_scale(
  p_value jsonb, p_required boolean, p_max smallint
)
returns smallint
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  parsed integer;
begin
  if p_value is null or p_value = 'null'::jsonb then
    if p_required then
      raise exception 'Required V1 scale answer is missing' using errcode = '22023';
    end if;
    return null;
  end if;
  if jsonb_typeof(p_value) is distinct from 'number'
    or p_value::text !~ '^[0-9]+$' then
    raise exception 'V1 scale answer must be an integer' using errcode = '22023';
  end if;
  parsed := (p_value::text)::integer;
  if parsed not between 1 and p_max then
    raise exception 'V1 scale answer is out of range' using errcode = '22023';
  end if;
  return parsed::smallint;
end;
$$;

revoke all on function private.onboarding_v1_scale(jsonb, boolean, smallint)
  from public, anon, authenticated, service_role;

-- The existing public.complete_onboarding() locks the draft, checks its
-- revision, calls this helper, and only then marks completion. Any exception
-- here rolls back all normalized changes and the completion marker.
create or replace function private.apply_onboarding_completion(
  p_version integer, p_responses jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  v1_definition jsonb;
  curated_count bigint;
  first_position smallint;
  last_position smallint;
  display_name text;
  avatar_key text;
  demographics jsonb;
  discovery jsonb;
  exploration jsonb;
  reactions jsonb;
  age_range text;
  gender text;
  runtime_preference text;
  liked_genres uuid[];
  disliked_genres uuid[];
  movie_priorities text[];
  watch_intents text[];
  trash_tolerance smallint;
  discovery_level smallint;
  popularity_preference smallint;
  classic_openness smallint;
  international_openness smallint;
  movie_knowledge_self_rating smallint;
  reaction_key text;
  reaction_value jsonb;
  reaction_movie_id uuid;
  reaction_ids uuid[] := array[]::uuid[];
  reaction_values smallint[] := array[]::smallint[];
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- There is no V1 row or movie set in this delta. The later publish migration
  -- must deliberately insert both and use this contract marker.
  if p_version is distinct from 1 then
    raise exception 'Onboarding completion is not configured for this version'
      using errcode = '0A000';
  end if;
  select v.definition into v1_definition
  from public.onboarding_versions as v
  where v.version = 1 and v.required_for_main
    and v.published_at <= statement_timestamp()
  for share;
  if not found or v1_definition ->> 'contract' is distinct from 'trashmovies_onboarding_v1' then
    raise exception 'Onboarding V1 is not published with its final contract'
      using errcode = '0A000';
  end if;

  select count(*), min(position), max(position)
  into curated_count, first_position, last_position
  from public.onboarding_version_movies
  where onboarding_version = 1;
  if curated_count <> 15 or first_position <> 1 or last_position <> 15 then
    raise exception 'Onboarding V1 curated movie set is not published'
      using errcode = '0A000';
  end if;

  if jsonb_typeof(p_responses) is distinct from 'object' then
    raise exception 'V1 responses must be an object' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_responses) as item(key)
    where item.key <> all(array[
      'display_name', 'avatar_choice', 'demographics', 'liked_genres',
      'disliked_genres', 'movie_reactions', 'movie_priorities', 'watch_intent',
      'trash_tolerance', 'discovery_preferences', 'exploration_preferences',
      'movie_knowledge_self_rating'
    ]::text[])
  ) then
    raise exception 'Unknown V1 response key' using errcode = '22023';
  end if;

  if jsonb_typeof(p_responses -> 'display_name') is distinct from 'string' then
    raise exception 'V1 display name is required' using errcode = '22023';
  end if;
  display_name := regexp_replace(
    p_responses ->> 'display_name', '^[[:space:]]+|[[:space:]]+$', '', 'g'
  );
  if char_length(display_name) not between 1 and 60 then
    raise exception 'Invalid V1 display name' using errcode = '22023';
  end if;

  if jsonb_typeof(p_responses -> 'avatar_choice') is distinct from 'string' then
    raise exception 'V1 avatar choice is required' using errcode = '22023';
  end if;
  avatar_key := p_responses ->> 'avatar_choice';
  if avatar_key <> all(array[
    'avatar_01', 'avatar_02', 'avatar_03', 'avatar_04',
    'avatar_05', 'avatar_06', 'avatar_07', 'avatar_08',
    'avatar_09', 'avatar_10', 'avatar_11', 'avatar_12'
  ]::text[]) then
    raise exception 'Unknown V1 avatar choice' using errcode = '22023';
  end if;

  demographics := p_responses -> 'demographics';
  if demographics is null or demographics = 'null'::jsonb then
    demographics := '{}'::jsonb;
  elsif jsonb_typeof(demographics) is distinct from 'object' then
    raise exception 'V1 demographics must be an object' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(demographics) as item(key)
    where item.key <> all(array['age_range', 'gender']::text[])
  ) then
    raise exception 'Unknown V1 demographics key' using errcode = '22023';
  end if;
  if demographics ? 'age_range' and demographics -> 'age_range' <> 'null'::jsonb then
    if jsonb_typeof(demographics -> 'age_range') is distinct from 'string'
      or demographics ->> 'age_range' <> all(array[
        '13_17', '18_24', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say'
      ]::text[]) then
      raise exception 'Invalid V1 age range' using errcode = '22023';
    end if;
    age_range := demographics ->> 'age_range';
  end if;
  if demographics ? 'gender' and demographics -> 'gender' <> 'null'::jsonb then
    if jsonb_typeof(demographics -> 'gender') is distinct from 'string'
      or demographics ->> 'gender' <> all(array[
        'woman', 'man', 'non_binary', 'another_identity', 'prefer_not_to_say'
      ]::text[]) then
      raise exception 'Invalid V1 gender' using errcode = '22023';
    end if;
    gender := demographics ->> 'gender';
  end if;

  liked_genres := private.onboarding_v1_uuid_choices(
    p_responses -> 'liked_genres', 1, 5
  );
  disliked_genres := private.onboarding_v1_uuid_choices(
    case when p_responses -> 'disliked_genres' is null
      or p_responses -> 'disliked_genres' = 'null'::jsonb
      then '[]'::jsonb else p_responses -> 'disliked_genres' end,
    0, 3
  );
  if liked_genres && disliked_genres then
    raise exception 'Liked and disliked genres overlap' using errcode = '22023';
  end if;
  if (
    select count(*) from public.genres as g
    where g.id = any(liked_genres || disliked_genres)
  ) <> cardinality(liked_genres) + cardinality(disliked_genres) then
    raise exception 'Unknown V1 genre ID' using errcode = '22023';
  end if;

  movie_priorities := private.onboarding_v1_text_choices(
    p_responses -> 'movie_priorities',
    array['story', 'characters', 'atmosphere', 'visuals', 'humor',
      'ideas', 'pace', 'music', 'originality', 'absurdity']::text[],
    1, 3
  );
  watch_intents := private.onboarding_v1_text_choices(
    p_responses -> 'watch_intent',
    array['have_fun', 'feel_tension', 'be_surprised', 'think',
      'feel_emotion', 'high_energy', 'relax', 'embrace_absurdity']::text[],
    1, 3
  );
  trash_tolerance := private.onboarding_v1_scale(
    p_responses -> 'trash_tolerance', true, 5
  );

  discovery := p_responses -> 'discovery_preferences';
  if jsonb_typeof(discovery) is distinct from 'object' then
    raise exception 'V1 discovery preferences are required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(discovery) as item(key)
    where item.key <> all(array['discovery_level', 'popularity_preference']::text[])
  ) then
    raise exception 'Unknown V1 discovery preference key' using errcode = '22023';
  end if;
  discovery_level := private.onboarding_v1_scale(discovery -> 'discovery_level', true, 5);
  popularity_preference := private.onboarding_v1_scale(
    discovery -> 'popularity_preference', false, 5
  );

  exploration := p_responses -> 'exploration_preferences';
  if exploration is null or exploration = 'null'::jsonb then
    exploration := '{}'::jsonb;
  elsif jsonb_typeof(exploration) is distinct from 'object' then
    raise exception 'V1 exploration preferences must be an object' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(exploration) as item(key)
    where item.key <> all(array[
      'classic_openness', 'international_openness', 'runtime_preference'
    ]::text[])
  ) then
    raise exception 'Unknown V1 exploration preference key' using errcode = '22023';
  end if;
  classic_openness := private.onboarding_v1_scale(
    exploration -> 'classic_openness', false, 5
  );
  international_openness := private.onboarding_v1_scale(
    exploration -> 'international_openness', false, 5
  );
  if exploration ? 'runtime_preference'
    and exploration -> 'runtime_preference' <> 'null'::jsonb then
    if jsonb_typeof(exploration -> 'runtime_preference') is distinct from 'string'
      or exploration ->> 'runtime_preference' <> all(array[
        '60_90', '90_120', '120_150', '150_plus', 'no_preference'
      ]::text[]) then
      raise exception 'Invalid V1 runtime preference' using errcode = '22023';
    end if;
    runtime_preference := exploration ->> 'runtime_preference';
  end if;
  movie_knowledge_self_rating := private.onboarding_v1_scale(
    p_responses -> 'movie_knowledge_self_rating', false, 10
  );

  -- Reactions are a JSON object keyed by curated movie UUID, with values -1/+1.
  reactions := p_responses -> 'movie_reactions';
  if reactions is null or reactions = 'null'::jsonb then
    reactions := '{}'::jsonb;
  elsif jsonb_typeof(reactions) is distinct from 'object' then
    raise exception 'V1 movie reactions must be an object' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(reactions)) > 15 then
    raise exception 'Too many V1 movie reactions' using errcode = '22023';
  end if;
  for reaction_key, reaction_value in
    select key, value from jsonb_each(reactions)
  loop
    if reaction_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or reaction_value not in ('-1'::jsonb, '1'::jsonb) then
      raise exception 'Invalid V1 movie reaction' using errcode = '22023';
    end if;
    reaction_movie_id := reaction_key::uuid;
    if not exists (
      select 1 from public.onboarding_version_movies as m
      where m.onboarding_version = 1 and m.movie_id = reaction_movie_id
    ) then
      raise exception 'V1 reaction movie is not in the curated set' using errcode = '22023';
    end if;
    reaction_ids := array_append(reaction_ids, reaction_movie_id);
    reaction_values := array_append(reaction_values, (reaction_value::text)::smallint);
  end loop;

  -- The completed response is the initial authoritative snapshot for these
  -- V1-owned fields. Missing optional values clear to NULL/empty; other domains
  -- such as saved/watched/rating, daily activity, and future game scores remain.
  insert into public.profiles (id, display_name, avatar_key)
  values (caller_id, display_name, avatar_key)
  on conflict (id) do update
    set display_name = excluded.display_name, avatar_key = excluded.avatar_key;

  insert into public.user_preferences
    (user_id, age_range, gender, movie_knowledge_self_rating)
  values (caller_id, age_range, gender, movie_knowledge_self_rating)
  on conflict (user_id) do update
    set age_range = excluded.age_range,
      gender = excluded.gender,
      movie_knowledge_self_rating = excluded.movie_knowledge_self_rating;

  delete from public.user_genre_preferences as g
  where g.user_id = caller_id and g.preference in (-1, 1);
  insert into public.user_genre_preferences (user_id, genre_id, preference)
  select caller_id, chosen.genre_id, chosen.preference
  from (
    select unnest(liked_genres) as genre_id, 1::smallint as preference
    union all
    select unnest(disliked_genres) as genre_id, -1::smallint as preference
  ) as chosen;

  delete from public.user_movie_preferences as p
  where p.user_id = caller_id and p.movie_id in (
    select m.movie_id from public.onboarding_version_movies as m
    where m.onboarding_version = 1
  );
  insert into public.user_movie_preferences (user_id, movie_id, preference)
  select caller_id, chosen.movie_id, chosen.preference
  from unnest(reaction_ids, reaction_values) as chosen(movie_id, preference);

  insert into public.user_recommendation_preferences as current_preferences (
    user_id, movie_priorities, watch_intents, trash_tolerance,
    discovery_level, popularity_preference, classic_openness,
    international_openness, runtime_preference
  ) values (
    caller_id, movie_priorities, watch_intents, trash_tolerance,
    discovery_level, popularity_preference, classic_openness,
    international_openness, runtime_preference
  )
  on conflict (user_id) do update set
    movie_priorities = excluded.movie_priorities,
    watch_intents = excluded.watch_intents,
    trash_tolerance = excluded.trash_tolerance,
    discovery_level = excluded.discovery_level,
    popularity_preference = excluded.popularity_preference,
    classic_openness = excluded.classic_openness,
    international_openness = excluded.international_openness,
    runtime_preference = excluded.runtime_preference,
    revision = current_preferences.revision + 1;
end;
$$;

revoke all on function private.apply_onboarding_completion(integer, jsonb)
  from public, anon, authenticated, service_role;
