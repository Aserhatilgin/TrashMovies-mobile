-- Private helpers are not exposed through the Data API. Client RPCs below need
-- SECURITY DEFINER to initialize protected rows/read auth metadata and to write
-- RPC-only onboarding/reveal tables. They always derive ownership from auth.uid().
create schema if not exists private;

create function private.user_domain_display_name(p_metadata jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select normalized.display_name
  from unnest(array['display_name', 'full_name', 'name']) with ordinality as candidate(key, priority)
  cross join lateral (
    select regexp_replace(
      p_metadata ->> candidate.key, '^[[:space:]]+|[[:space:]]+$', '', 'g'
    ) as display_name
  ) as normalized
  where jsonb_typeof(p_metadata -> candidate.key) = 'string'
    and char_length(normalized.display_name) between 1 and 60
  order by candidate.priority
  limit 1;
$$;

revoke all on function private.user_domain_display_name(jsonb)
  from public, anon, authenticated, service_role;

-- Fail closed until the actual v1 question IDs, required answers, permitted
-- avatars, and normalization mappings have been approved. A later v1 migration
-- must replace this helper with version-specific validation and writes to
-- profiles/user_preferences/user_genre_preferences. Omitted attributes should
-- preserve existing values; explicit clearing must be defined by that contract.
-- Keep this helper private and derive its user identity from auth.uid().
create function private.apply_onboarding_completion(p_version integer, p_responses jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Onboarding completion is not configured for this version'
    using errcode = '0A000',
      hint = 'Publish the finalized questionnaire and install its validator/normalizer before enabling completion.';
end;
$$;

revoke all on function private.apply_onboarding_completion(integer, jsonb)
  from public, anon, authenticated, service_role;

create function public.initialize_user_domain()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  seed_name text;
  current_version integer;
  profile_row public.profiles%rowtype;
  onboarding_row public.user_onboarding%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select private.user_domain_display_name(u.raw_user_meta_data)
  into seed_name
  from auth.users as u where u.id = caller_id;
  if not found then
    raise exception 'Authenticated user no longer exists' using errcode = '28000';
  end if;

  insert into public.profiles (id, display_name)
  values (caller_id, seed_name)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (caller_id)
  on conflict (user_id) do nothing;

  select v.version into current_version
  from public.onboarding_versions as v
  where v.published_at <= statement_timestamp()
  order by v.version desc
  limit 1
  for share;

  if current_version is not null then
    insert into public.user_onboarding (user_id, onboarding_version)
    values (caller_id, current_version)
    on conflict (user_id, onboarding_version) do nothing;

    select o.* into onboarding_row
    from public.user_onboarding as o
    where o.user_id = caller_id and o.onboarding_version = current_version;
  end if;

  select p.* into profile_row from public.profiles as p where p.id = caller_id;

  return jsonb_build_object(
    'profile', to_jsonb(profile_row),
    'onboarding', jsonb_build_object(
      'version', current_version,
      'status', case
        when current_version is null then 'not_configured'
        when onboarding_row.completed_at is not null then 'completed'
        when onboarding_row.started_at is not null then 'in_progress'
        else 'not_started'
      end,
      'completed', current_version is not null and onboarding_row.completed_at is not null,
      'progress', case when current_version is null then null else to_jsonb(onboarding_row) end
    )
  );
end;
$$;

revoke all on function public.initialize_user_domain() from public, anon, authenticated, service_role;
grant execute on function public.initialize_user_domain() to authenticated, service_role;

create function public.save_onboarding_progress(
  p_version integer,
  p_expected_revision bigint,
  p_responses jsonb,
  p_current_step text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  onboarding_row public.user_onboarding%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_version is null or p_version <= 0
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid onboarding version or revision' using errcode = '22023';
  end if;
  if p_responses is null or jsonb_typeof(p_responses) <> 'object'
    or octet_length(p_responses::text) > 32768 then
    raise exception 'Onboarding responses must be a JSON object within 32 KiB'
      using errcode = '22023';
  end if;
  if p_current_step is not null and (
    p_current_step <> btrim(p_current_step)
    or p_current_step ~ '^[[:space:]]|[[:space:]]$'
    or char_length(p_current_step) not between 1 and 64
  ) then
    raise exception 'Invalid onboarding step' using errcode = '22023';
  end if;

  perform 1 from public.onboarding_versions as v
  where v.version = p_version and v.published_at <= statement_timestamp()
  for share;
  if not found then
    raise exception 'Onboarding version is not published' using errcode = '22023';
  end if;

  -- A first save can create its empty draft. No answers/completion are fabricated.
  insert into public.user_onboarding (user_id, onboarding_version)
  values (caller_id, p_version)
  on conflict (user_id, onboarding_version) do nothing;

  select o.* into onboarding_row
  from public.user_onboarding as o
  where o.user_id = caller_id and o.onboarding_version = p_version
  for update;

  if onboarding_row.completed_at is not null then
    raise exception 'Completed onboarding cannot be changed by progress saves'
      using errcode = '55000';
  end if;

  if onboarding_row.revision <> p_expected_revision then
    -- An exact retry after a lost response returns the already-saved revision.
    if onboarding_row.revision > 0
      and onboarding_row.revision - 1 = p_expected_revision
      and onboarding_row.responses = p_responses
      and onboarding_row.current_step is not distinct from p_current_step then
      return to_jsonb(onboarding_row);
    end if;
    raise exception 'Onboarding revision conflict'
      using errcode = '40001', hint = 'Reload progress before saving again.';
  end if;

  if onboarding_row.started_at is not null
    and onboarding_row.responses = p_responses
    and onboarding_row.current_step is not distinct from p_current_step then
    return to_jsonb(onboarding_row);
  end if;

  update public.user_onboarding as o
  set responses = p_responses,
    current_step = p_current_step,
    started_at = coalesce(o.started_at, statement_timestamp()),
    revision = o.revision + 1
  where o.user_id = caller_id and o.onboarding_version = p_version
  returning o.* into onboarding_row;

  -- Draft content is intentionally not interpreted as finalized questionnaire
  -- answers here. The later version-specific completion helper validates it.
  return to_jsonb(onboarding_row);
end;
$$;

revoke all on function public.save_onboarding_progress(integer, bigint, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.save_onboarding_progress(integer, bigint, jsonb, text)
  to authenticated, service_role;

create function public.complete_onboarding(p_version integer, p_expected_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  onboarding_row public.user_onboarding%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_version is null or p_version <= 0
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid onboarding version or revision' using errcode = '22023';
  end if;

  perform 1 from public.onboarding_versions as v
  where v.version = p_version and v.published_at <= statement_timestamp()
  for share;
  if not found then
    raise exception 'Onboarding version is not published' using errcode = '22023';
  end if;

  select o.* into onboarding_row
  from public.user_onboarding as o
  where o.user_id = caller_id and o.onboarding_version = p_version
  for update;
  if not found then
    raise exception 'Onboarding progress has not been initialized' using errcode = '55000';
  end if;

  -- Completed retries never normalize an old snapshot over newer preferences.
  if onboarding_row.completed_at is not null then
    return to_jsonb(onboarding_row);
  end if;
  if onboarding_row.revision <> p_expected_revision then
    raise exception 'Onboarding revision conflict'
      using errcode = '40001', hint = 'Reload progress before completing onboarding.';
  end if;
  if onboarding_row.started_at is null then
    raise exception 'Onboarding has not been started' using errcode = '55000';
  end if;

  -- Currently raises 0A000. Once v1 is approved, the private helper must validate
  -- that exact version and normalize all supported fields in this transaction.
  -- Any validation/normalization failure rolls back every write and completion.
  perform private.apply_onboarding_completion(p_version, onboarding_row.responses);

  -- Evaluate after locking/normalization and clamp to the saved start time.
  update public.user_onboarding as o
  set completed_at = greatest(clock_timestamp(), o.started_at),
    completion_source = 'user',
    revision = o.revision + 1
  where o.user_id = caller_id and o.onboarding_version = p_version
  returning o.* into onboarding_row;

  return to_jsonb(onboarding_row);
end;
$$;

revoke all on function public.complete_onboarding(integer, bigint) from public, anon, authenticated, service_role;
grant execute on function public.complete_onboarding(integer, bigint) to authenticated, service_role;

create function public.record_daily_movie_reveal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  reveal_time timestamptz := statement_timestamp();
  today_in_istanbul date := (reveal_time at time zone 'Europe/Istanbul')::date;
  reveal_row public.user_daily_movie_reveals%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform 1 from public.daily_movies as d where d.scheduled_date = today_in_istanbul
  for key share;
  if not found then
    raise exception 'No Movie of the Day is scheduled for today' using errcode = 'P0002';
  end if;

  insert into public.user_daily_movie_reveals (user_id, scheduled_date, revealed_at)
  values (caller_id, today_in_istanbul, reveal_time)
  on conflict (user_id, scheduled_date) do nothing;

  select r.* into reveal_row from public.user_daily_movie_reveals as r
  where r.user_id = caller_id and r.scheduled_date = today_in_istanbul;

  -- Repeated calls preserve and return the first reveal timestamp.
  return to_jsonb(reveal_row);
end;
$$;

revoke all on function public.record_daily_movie_reveal() from public, anon, authenticated, service_role;
grant execute on function public.record_daily_movie_reveal() to authenticated, service_role;
