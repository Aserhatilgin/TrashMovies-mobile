-- Current taste is independent of immutable onboarding answers/completion.
-- One existing recommendation revision covers all four taste relations.
create function public.get_movie_taste()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  -- One statement/snapshot: never mix a new revision with old child rows.
  with curated as (
    select c.movie_id, c.position
    from public.onboarding_version_movies c
    join public.onboarding_versions v on v.version = c.onboarding_version
    where c.onboarding_version = 1 and v.published_at <= statement_timestamp()
      and v.definition ->> 'contract' = 'trashmovies_onboarding_v1'
  )
  select jsonb_build_object(
    'user_id', caller_id,
    'revision', coalesce(r.revision, 0),
    'preferences', jsonb_build_object(
      'liked_genres', coalesce((select jsonb_agg(g.genre_id order by g.genre_id)
        from public.user_genre_preferences g where g.user_id = caller_id and g.preference = 1), '[]'::jsonb),
      'disliked_genres', coalesce((select jsonb_agg(g.genre_id order by g.genre_id)
        from public.user_genre_preferences g where g.user_id = caller_id and g.preference = -1), '[]'::jsonb),
      'movie_priorities', case when r.movie_priorities is null then null else
        to_jsonb(array(select x from unnest(r.movie_priorities) x order by x)) end,
      'watch_intents', case when r.watch_intents is null then null else
        to_jsonb(array(select x from unnest(r.watch_intents) x order by x)) end,
      'trash_tolerance', r.trash_tolerance,
      'discovery_level', r.discovery_level,
      'popularity_preference', r.popularity_preference,
      'classic_openness', r.classic_openness,
      'international_openness', r.international_openness,
      'runtime_preference', r.runtime_preference,
      'movie_knowledge_self_rating', u.movie_knowledge_self_rating,
      'movie_reactions', coalesce((select jsonb_object_agg(p.movie_id::text, p.preference)
        from public.user_movie_preferences p where p.user_id = caller_id), '{}'::jsonb)
    ),
    'genres', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name, g.id)
      from public.genres g), '[]'::jsonb),
    'editable_movie_ids', coalesce((select jsonb_agg(c.movie_id order by c.position) from curated c), '[]'::jsonb),
    'movies', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title,
      'poster_path', m.poster_path, 'release_date', m.release_date) order by c.position nulls last, m.id)
      from public.movies m left join curated c on c.movie_id = m.id
      where c.movie_id is not null or exists (
        select 1 from public.user_movie_preferences p where p.user_id = caller_id and p.movie_id = m.id
      )), '[]'::jsonb)
  ) into result
  from (select caller_id as user_id) owner
  left join public.user_recommendation_preferences r on r.user_id = owner.user_id
  left join public.user_preferences u on u.user_id = owner.user_id;
  return result;
end;
$$;

revoke all on function public.get_movie_taste() from public, anon, authenticated, service_role;
grant execute on function public.get_movie_taste() to authenticated, service_role;

create function public.save_movie_taste(
  p_expected_revision bigint, p_preferences jsonb, p_expected_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_revision bigint;
  liked uuid[];
  disliked uuid[];
  priorities text[];
  intents text[];
  trash smallint;
  discovery smallint;
  popularity smallint;
  classic smallint;
  international smallint;
  runtime text;
  knowledge smallint;
  reactions jsonb;
  reaction_key text;
  reaction_value jsonb;
  desired jsonb;
  current_values jsonb;
  snapshot jsonb;
  curated_ids uuid[];
begin
  if caller_id is null or caller_id is distinct from p_expected_user_id then
    raise exception 'Authentication identity mismatch' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid taste revision' using errcode = '22023';
  end if;
  if jsonb_typeof(p_preferences) is distinct from 'object'
    or octet_length(p_preferences::text) > 32768 then
    raise exception 'Invalid taste payload' using errcode = '22023';
  end if;
  if not (p_preferences ?& array['liked_genres', 'disliked_genres', 'movie_priorities', 'watch_intents',
      'trash_tolerance', 'discovery_level', 'popularity_preference', 'classic_openness',
      'international_openness', 'runtime_preference', 'movie_reactions', 'movie_knowledge_self_rating'])
    or (select count(*) from jsonb_object_keys(p_preferences)) <> 12 then
    raise exception 'Unexpected or missing taste fields' using errcode = '22023';
  end if;
  -- Do not bypass the required onboarding, or normalize its historic responses.
  if exists (
    select 1 from public.onboarding_versions v
    where v.version = (select max(x.version) from public.onboarding_versions x
      where x.required_for_main and x.published_at <= statement_timestamp())
      and not exists (select 1 from public.user_onboarding o where o.user_id = caller_id
        and o.onboarding_version = v.version and o.completed_at is not null)
  ) then
    raise exception 'Required onboarding is incomplete' using errcode = '55000';
  end if;
  select array_agg(c.movie_id order by c.position) into curated_ids
  from public.onboarding_version_movies c join public.onboarding_versions v on v.version = c.onboarding_version
  where c.onboarding_version = 1 and v.published_at <= statement_timestamp()
    and v.definition ->> 'contract' = 'trashmovies_onboarding_v1';
  if coalesce(cardinality(curated_ids), 0) <> 15 then
    raise exception 'Published V1 movie set is unavailable' using errcode = '55000';
  end if;

  liked := private.onboarding_v1_uuid_choices(p_preferences -> 'liked_genres', 1, 5);
  disliked := private.onboarding_v1_uuid_choices(p_preferences -> 'disliked_genres', 0, 3);
  if liked && disliked or (select count(*) from public.genres g where g.id = any(liked || disliked))
      <> cardinality(liked) + cardinality(disliked) then
    raise exception 'Unknown or overlapping genres' using errcode = '22023';
  end if;
  priorities := private.onboarding_v1_text_choices(p_preferences -> 'movie_priorities',
    array['story', 'characters', 'atmosphere', 'visuals', 'humor', 'ideas', 'pace', 'music', 'originality', 'absurdity'], 1, 3);
  intents := private.onboarding_v1_text_choices(p_preferences -> 'watch_intents',
    array['have_fun', 'feel_tension', 'be_surprised', 'think', 'feel_emotion', 'high_energy', 'relax', 'embrace_absurdity'], 1, 3);
  trash := private.onboarding_v1_scale(p_preferences -> 'trash_tolerance', true, 5::smallint);
  discovery := private.onboarding_v1_scale(p_preferences -> 'discovery_level', true, 5::smallint);
  popularity := private.onboarding_v1_scale(p_preferences -> 'popularity_preference', false, 5::smallint);
  classic := private.onboarding_v1_scale(p_preferences -> 'classic_openness', false, 5::smallint);
  international := private.onboarding_v1_scale(p_preferences -> 'international_openness', false, 5::smallint);
  knowledge := private.onboarding_v1_scale(p_preferences -> 'movie_knowledge_self_rating', false, 10::smallint);
  if p_preferences -> 'runtime_preference' <> 'null'::jsonb then
    if jsonb_typeof(p_preferences -> 'runtime_preference') is distinct from 'string'
      or p_preferences ->> 'runtime_preference' <> all(array['60_90', '90_120', '120_150', '150_plus', 'no_preference']) then
      raise exception 'Invalid runtime preference' using errcode = '22023';
    end if;
    runtime := p_preferences ->> 'runtime_preference';
  end if;
  reactions := p_preferences -> 'movie_reactions';
  if jsonb_typeof(reactions) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(reactions)) > 15 then
    raise exception 'Invalid movie reactions' using errcode = '22023';
  end if;
  for reaction_key, reaction_value in select key, value from jsonb_each(reactions) loop
    if reaction_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or reaction_value not in ('-1'::jsonb, '1'::jsonb) then
      raise exception 'Invalid movie reaction' using errcode = '22023';
    end if;
    if not (reaction_key::uuid = any(curated_ids)) then
      raise exception 'Reaction is outside published V1' using errcode = '22023';
    end if;
  end loop;
  desired := jsonb_build_object(
    'liked_genres', array(select x from unnest(liked) x order by x),
    'disliked_genres', array(select x from unnest(disliked) x order by x),
    'movie_priorities', array(select x from unnest(priorities) x order by x),
    'watch_intents', array(select x from unnest(intents) x order by x),
    'trash_tolerance', trash, 'discovery_level', discovery, 'popularity_preference', popularity,
    'classic_openness', classic, 'international_openness', international,
    'runtime_preference', runtime, 'movie_reactions', reactions, 'movie_knowledge_self_rating', knowledge);

  -- This is also the serialization point for first saves with no settings row.
  insert into public.user_recommendation_preferences (user_id) values (caller_id)
  on conflict (user_id) do nothing;
  select r.revision into current_revision from public.user_recommendation_preferences r
  where r.user_id = caller_id for update;
  snapshot := public.get_movie_taste();
  current_values := jsonb_set(snapshot -> 'preferences', '{movie_reactions}',
    coalesce((select jsonb_object_agg(e.key, e.value)
      from jsonb_each(snapshot -> 'preferences' -> 'movie_reactions') e
      where e.key::uuid = any(curated_ids)), '{}'::jsonb));
  if current_revision <> p_expected_revision then
    -- Exact lost-response retry: acknowledge without a second increment/write.
    if current_revision - 1 = p_expected_revision and current_values = desired then
      return snapshot;
    end if;
    raise exception 'Taste revision conflict' using errcode = '40001';
  end if;
  if current_values = desired then return snapshot; end if;

  delete from public.user_genre_preferences where user_id = caller_id;
  insert into public.user_genre_preferences (user_id, genre_id, preference)
  select caller_id, x, 1 from unnest(liked) x
  union all select caller_id, x, -1 from unnest(disliked) x;
  -- Never remove or update reactions outside this server-owned set.
  delete from public.user_movie_preferences where user_id = caller_id and movie_id = any(curated_ids);
  insert into public.user_movie_preferences (user_id, movie_id, preference)
  select caller_id, e.key::uuid, (e.value::text)::smallint from jsonb_each(reactions) e;
  insert into public.user_preferences (user_id, movie_knowledge_self_rating) values (caller_id, knowledge)
  on conflict (user_id) do update set movie_knowledge_self_rating = excluded.movie_knowledge_self_rating;
  update public.user_recommendation_preferences set
    movie_priorities = priorities, watch_intents = intents, trash_tolerance = trash,
    discovery_level = discovery, popularity_preference = popularity, classic_openness = classic,
    international_openness = international, runtime_preference = runtime, revision = revision + 1
  where user_id = caller_id;
  return public.get_movie_taste();
end;
$$;

revoke all on function public.save_movie_taste(bigint, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.save_movie_taste(bigint, jsonb, uuid) to authenticated, service_role;

-- Close both table- and column-level routes around the shared CAS revision.
revoke insert, update, delete, truncate on public.user_genre_preferences from public, anon, authenticated;
revoke insert (user_id, genre_id, preference), update (preference)
  on public.user_genre_preferences from public, anon, authenticated;
drop policy "Users can insert their genre preferences" on public.user_genre_preferences;
drop policy "Users can update their genre preferences" on public.user_genre_preferences;
drop policy "Users can delete their genre preferences" on public.user_genre_preferences;
revoke update (movie_knowledge_self_rating) on public.user_preferences from public, anon, authenticated;
-- Existing UPDATE(age_range, gender) and owner RLS intentionally remain.
comment on column public.user_recommendation_preferences.revision is
  'Current taste generation across recommendation, genre, movie reaction and knowledge preferences; future recommendations must carry this revision.';
