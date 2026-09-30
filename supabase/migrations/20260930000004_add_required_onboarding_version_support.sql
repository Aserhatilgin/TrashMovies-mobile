-- Published rows are immutable under the existing guard, so later publish
-- migrations must set this flag when inserting each version.
alter table public.onboarding_versions
  add column required_for_main boolean not null default false;

comment on column public.onboarding_versions.required_for_main is
  'Only published versions with this flag gate Main routing. Optional newer versions never invalidate an earlier required completion.';

comment on table public.onboarding_versions is
  'Server-managed immutable published definitions. The highest published required version gates Main; the highest published version may be optional. V1 is not seeded here.';

create or replace function public.initialize_user_domain()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  seed_name text;
  required_version integer;
  latest_version integer;
  profile_row public.profiles%rowtype;
  required_row public.user_onboarding%rowtype;
  latest_row public.user_onboarding%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select private.user_domain_display_name(u.raw_user_meta_data)
  into seed_name from auth.users as u where u.id = caller_id;
  if not found then
    raise exception 'Authenticated user no longer exists' using errcode = '28000';
  end if;

  insert into public.profiles (id, display_name)
  values (caller_id, seed_name)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (caller_id)
  on conflict (user_id) do nothing;

  -- Read both routing versions from one snapshot so concurrent publication
  -- cannot mix an old required version with a newly visible latest version.
  with published as (
    select v.version, v.required_for_main
    from public.onboarding_versions as v
    where v.published_at <= statement_timestamp()
    for share
  )
  select max(version) filter (where required_for_main), max(version)
  into required_version, latest_version
  from published;

  if required_version is not null then
    insert into public.user_onboarding (user_id, onboarding_version)
    values (caller_id, required_version)
    on conflict (user_id, onboarding_version) do nothing;

    select o.* into required_row from public.user_onboarding as o
    where o.user_id = caller_id and o.onboarding_version = required_version;
  end if;

  if latest_version is not null then
    if latest_version = required_version then
      latest_row := required_row;
    else
      -- Optional progress is reported only when the user has already started it.
      select o.* into latest_row from public.user_onboarding as o
      where o.user_id = caller_id and o.onboarding_version = latest_version;
    end if;
  end if;

  select p.* into profile_row from public.profiles as p where p.id = caller_id;

  return jsonb_build_object(
    'profile', to_jsonb(profile_row),
    'onboarding', jsonb_build_object(
      'required_version', required_version,
      'required_completed', required_version is null or required_row.completed_at is not null,
      'latest_version', latest_version,
      'latest_completed', latest_version is not null and latest_row.completed_at is not null,
      'status', case
        when latest_version is null then 'not_configured'
        when required_version is null then 'not_required'
        when required_row.completed_at is not null then 'completed'
        when required_row.started_at is not null then 'in_progress'
        else 'not_started'
      end,
      'required_progress', case when required_version is null then null else to_jsonb(required_row) end,
      'latest_progress', case when latest_row.user_id is null then null else to_jsonb(latest_row) end
    )
  );
end;
$$;

revoke all on function public.initialize_user_domain()
  from public, anon, authenticated, service_role;
grant execute on function public.initialize_user_domain() to authenticated, service_role;
