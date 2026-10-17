-- Publish only after the immutable definition and exact curated set are ready.
-- One DO statement is atomic, including when the runner has no outer transaction:
-- any exception rolls back every write. No exception is caught or suppressed.
do $publish_onboarding_v1$
declare
  expected_definition constant jsonb := $definition$
  {
    "contract": "trashmovies_onboarding_v1",
    "version": 1,
    "allow_unknown_answers": false,
    "questions": [
      {"id": "display_name", "type": "string", "required": true,
        "trim": "surrounding_whitespace", "minLength": 1, "maxLength": 60},
      {"id": "avatar_choice", "type": "string", "required": true,
        "enum": ["avatar_01", "avatar_02", "avatar_03", "avatar_04",
          "avatar_05", "avatar_06", "avatar_07", "avatar_08",
          "avatar_09", "avatar_10", "avatar_11", "avatar_12",
          "avatar_13", "avatar_14", "avatar_15", "avatar_16"]},
      {"id": "liked_genres", "type": "array", "required": true,
        "minItems": 1, "maxItems": 5, "uniqueItems": true,
        "items": {"type": "string", "format": "uuid", "reference": "public.genres.id"}},
      {"id": "movie_priorities", "type": "array", "required": true,
        "minItems": 1, "maxItems": 3, "uniqueItems": true,
        "items": {"type": "string", "enum": ["story", "characters", "atmosphere",
          "visuals", "humor", "ideas", "pace", "music", "originality", "absurdity"]}},
      {"id": "watch_intent", "type": "array", "required": true,
        "minItems": 1, "maxItems": 3, "uniqueItems": true,
        "items": {"type": "string", "enum": ["have_fun", "feel_tension", "be_surprised",
          "think", "feel_emotion", "high_energy", "relax", "embrace_absurdity"]}},
      {"id": "trash_tolerance", "type": "integer", "required": true,
        "minimum": 1, "maximum": 5},
      {"id": "discovery_preferences", "type": "object", "required": true,
        "additionalProperties": false, "properties": {
          "discovery_level": {"type": "integer", "required": true, "minimum": 1, "maximum": 5},
          "popularity_preference": {"type": "integer", "required": false,
            "nullable": true, "minimum": 1, "maximum": 5}
        }},
      {"id": "disliked_genres", "type": "array", "required": false, "nullable": true,
        "minItems": 0, "maxItems": 3, "uniqueItems": true, "disjoint_from": "liked_genres",
        "items": {"type": "string", "format": "uuid", "reference": "public.genres.id"}},
      {"id": "movie_reactions", "type": "object", "required": false, "nullable": true,
        "maxProperties": 15,
        "propertyNames": {"format": "uuid", "reference": "public.onboarding_version_movies.movie_id",
          "onboarding_version": 1},
        "additionalProperties": {"type": "integer", "enum": [-1, 1]}},
      {"id": "exploration_preferences", "type": "object", "required": false, "nullable": true,
        "additionalProperties": false, "properties": {
          "classic_openness": {"type": "integer", "required": false,
            "nullable": true, "minimum": 1, "maximum": 5},
          "international_openness": {"type": "integer", "required": false,
            "nullable": true, "minimum": 1, "maximum": 5},
          "runtime_preference": {"type": "string", "required": false, "nullable": true,
            "enum": ["60_90", "90_120", "120_150", "150_plus", "no_preference"]}
        }},
      {"id": "movie_knowledge_self_rating", "type": "integer", "required": false,
        "nullable": true, "minimum": 1, "maximum": 10},
      {"id": "demographics", "type": "object", "required": false, "nullable": true,
        "additionalProperties": false, "properties": {
          "age_range": {"type": "string", "required": false, "nullable": true,
            "enum": ["13_17", "18_24", "25_34", "35_44", "45_54", "55_plus", "prefer_not_to_say"]},
          "gender": {"type": "string", "required": false, "nullable": true,
            "enum": ["woman", "man", "non_binary", "another_identity", "prefer_not_to_say"]}
        }}
    ]
  }
  $definition$::jsonb;
  -- Authoritative identity/order lives in onboarding_version_movies, not JSON.
  approved_movie_ids constant uuid[] := array[
    'e2e3b400-5219-4d69-a706-ff05653825c5', --  1 The Dark Knight
    'd44bc6b1-292c-4a81-90fb-97988d98c637', --  2 Interstellar
    'fd26ec0a-994b-4fc8-bc55-0fcbc04345cd', --  3 The Conjuring
    '627a80f2-3e6a-4538-ac89-c3b1f83007ba', --  4 La La Land
    'aa821107-d51b-4475-a599-bec9354ab268', --  5 The Grand Budapest Hotel
    '6b66e3f1-e3a6-4c39-8bfb-02ed6cb9089c', --  6 Parasite
    '82c25ab2-e421-47cf-984a-3172f143930d', --  7 Spirited Away
    '8b111814-f391-4497-bf01-4b3b55b3d22d', --  8 The Godfather
    '3fead38d-8fa0-4c9e-b092-a9ca9df23890', --  9 The Truman Show
    '6c336121-7304-4785-99e3-28975c0bfa22', -- 10 Mad Max: Fury Road
    '5bebc825-41fe-426b-800b-ae29c9df40e9', -- 11 Whiplash
    'fb7002f0-477f-434a-bf10-3beb456e1cfd', -- 12 The Notebook
    '0cd23787-7568-4160-aabe-3db5b4f54d17', -- 13 Get Out
    'ab81b28e-5e9c-49ac-9894-b3d7f59b7629', -- 14 Everything Everywhere All at Once
    '685617d6-9ada-47a0-8871-03a6d6e6447e'  -- 15 The Room
  ]::uuid[];
  version_row public.onboarding_versions%rowtype;
  missing_movie_ids text;
begin
  if exists (select 1 from public.onboarding_versions where version = 1) then
    raise exception 'Cannot publish onboarding V1: version 1 already exists; refusing to overwrite'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.onboarding_version_movies where onboarding_version = 1
  ) then
    raise exception 'Cannot publish onboarding V1: unexpected curated rows already exist'
      using errcode = '55000';
  end if;

  -- Infinity is a transaction-local unpublished sentinel, never a scheduled
  -- publication. Both deployed guards compare the old timestamp to wall time.
  insert into public.onboarding_versions (version, definition, published_at, required_for_main)
  values (1, expected_definition, 'infinity'::timestamptz, false)
  returning * into version_row;

  if version_row.definition is distinct from expected_definition
    or version_row.definition ->> 'contract' is distinct from 'trashmovies_onboarding_v1'
    or version_row.definition -> 'version' is distinct from '1'::jsonb then
    raise exception 'Cannot publish onboarding V1: inserted definition differs from the approved contract'
      using errcode = '55000';
  end if;

  if cardinality(approved_movie_ids) <> 15
    or (select count(distinct movie_id) from unnest(approved_movie_ids) as approved(movie_id)) <> 15 then
    raise exception 'Cannot publish onboarding V1: approved set must contain 15 distinct movie UUIDs'
      using errcode = '55000';
  end if;

  -- Keep referenced catalog identities stable until this transaction ends.
  perform m.id from public.movies as m
  where m.id = any(approved_movie_ids)
  order by m.id
  for key share;

  select string_agg(approved.movie_id::text, ', ' order by approved.position)
  into missing_movie_ids
  from unnest(approved_movie_ids) with ordinality as approved(movie_id, position)
  left join public.movies as m on m.id = approved.movie_id
  where m.id is null;
  if missing_movie_ids is not null then
    raise exception 'Cannot publish onboarding V1: approved movies missing from public.movies: %', missing_movie_ids
      using errcode = '23503';
  end if;

  insert into public.onboarding_version_movies (onboarding_version, position, movie_id)
  select 1, approved.position::smallint, approved.movie_id
  from unnest(approved_movie_ids) with ordinality as approved(movie_id, position)
  order by approved.position;

  if (select count(*) from public.onboarding_version_movies where onboarding_version = 1) <> 15 then
    raise exception 'Cannot publish onboarding V1: curated set must contain exactly 15 rows'
      using errcode = '55000';
  end if;

  -- FULL JOIN detects missing/extra positions and wrong UUIDs, including swaps
  -- that would pass count/min/max checks. Ordinality fixes positions at 1..15.
  if exists (
    select 1
    from unnest(approved_movie_ids) with ordinality as approved(movie_id, position)
    full join (
      select position, movie_id from public.onboarding_version_movies
      where onboarding_version = 1
    ) as actual on actual.position = approved.position
    where actual.position is null or approved.position is null
      or actual.movie_id is distinct from approved.movie_id
  ) then
    raise exception 'Cannot publish onboarding V1: curated position-to-UUID mapping differs from the approved set'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.onboarding_version_movies as curated
    left join public.movies as m on m.id = curated.movie_id
    where curated.onboarding_version = 1 and m.id is null
  ) then
    raise exception 'Cannot publish onboarding V1: curated set references a missing public.movies row'
      using errcode = '23503';
  end if;

  -- Set the Main gate only after validation, while the version is still editable.
  update public.onboarding_versions
  set required_for_main = true
  where version = 1
  returning * into version_row;
  if not found or version_row.definition is distinct from expected_definition
    or version_row.required_for_main is distinct from true
    or version_row.published_at is distinct from 'infinity'::timestamptz then
    raise exception 'Cannot publish onboarding V1: definition, required flag, or unpublished state differs'
      using errcode = '55000';
  end if;

  -- LAST WRITE: publish at execution time, consistent with both deployed guards.
  -- Never modify the definition or curated rows after this transition.
  update public.onboarding_versions
  set published_at = clock_timestamp()
  where version = 1
  returning * into version_row;
  if not found or version_row.definition is distinct from expected_definition
    or version_row.required_for_main is distinct from true
    or not isfinite(version_row.published_at)
    or version_row.published_at > clock_timestamp() then
    raise exception 'Cannot publish onboarding V1: final publication state differs'
      using errcode = '55000';
  end if;
end;
$publish_onboarding_v1$;
