-- Stable multi-select validation shared by the two recommendation arrays.
create function private.valid_recommendation_choices(p_values text[], p_allowed text[])
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  distinct_count bigint;
begin
  if coalesce(array_ndims(p_values), 1) <> 1 or cardinality(p_values) > 3 then
    return false;
  end if;
  if cardinality(p_values) = 0 then
    return true;
  end if;
  if array_position(p_values, null::text) is not null or not (p_values <@ p_allowed) then
    return false;
  end if;
  select count(distinct choice) into distinct_count
  from unnest(p_values) as item(choice);
  return cardinality(p_values) = distinct_count;
end;
$$;

revoke all on function private.valid_recommendation_choices(text[], text[])
  from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.valid_recommendation_choices(text[], text[])
  to service_role;

create table public.user_recommendation_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  movie_priorities text[],
  watch_intents text[],
  trash_tolerance smallint,
  discovery_level smallint,
  popularity_preference smallint,
  classic_openness smallint,
  international_openness smallint,
  runtime_preference text,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_recommendation_priorities_valid check (
    movie_priorities is null or private.valid_recommendation_choices(
      movie_priorities,
      array['story', 'characters', 'atmosphere', 'visuals', 'humor',
        'ideas', 'pace', 'music', 'originality', 'absurdity']::text[]
    )
  ),
  constraint user_recommendation_watch_intents_valid check (
    watch_intents is null or private.valid_recommendation_choices(
      watch_intents,
      array['have_fun', 'feel_tension', 'be_surprised', 'think',
        'feel_emotion', 'high_energy', 'relax', 'embrace_absurdity']::text[]
    )
  ),
  constraint user_recommendation_trash_tolerance_valid check (
    trash_tolerance is null or trash_tolerance between 1 and 5
  ),
  constraint user_recommendation_discovery_level_valid check (
    discovery_level is null or discovery_level between 1 and 5
  ),
  constraint user_recommendation_popularity_valid check (
    popularity_preference is null or popularity_preference between 1 and 5
  ),
  constraint user_recommendation_classic_valid check (
    classic_openness is null or classic_openness between 1 and 5
  ),
  constraint user_recommendation_international_valid check (
    international_openness is null or international_openness between 1 and 5
  ),
  constraint user_recommendation_runtime_valid check (
    runtime_preference is null or runtime_preference in (
      '60_90', '90_120', '120_150', '150_plus', 'no_preference'
    )
  ),
  constraint user_recommendation_revision_nonnegative check (revision >= 0)
);

comment on table public.user_recommendation_preferences is
  'Private current recommendation settings. NULL means unanswered; onboarding answers remain historical in user_onboarding.';

create trigger user_recommendation_preferences_set_updated_at
before update on public.user_recommendation_preferences
for each row execute function public.set_updated_at();

alter table public.user_recommendation_preferences enable row level security;
revoke all on table public.user_recommendation_preferences from public, anon, authenticated;
grant select on table public.user_recommendation_preferences to authenticated;
grant all on table public.user_recommendation_preferences to service_role;

create policy "Users can read their recommendation preferences"
on public.user_recommendation_preferences for select to authenticated
using (user_id = (select auth.uid()));
