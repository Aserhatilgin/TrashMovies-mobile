create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  age_range text,
  gender text,
  movie_knowledge_self_rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_preferences_age_range_valid check (
    age_range is null or age_range in (
      '13_17', '18_24', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say'
    )
  ),
  constraint user_preferences_gender_valid check (
    gender is null or gender in (
      'woman', 'man', 'non_binary', 'another_identity', 'prefer_not_to_say'
    )
  ),
  constraint user_preferences_knowledge_range check (
    movie_knowledge_self_rating is null or movie_knowledge_self_rating between 1 and 10
  )
);

comment on table public.user_preferences is
  'Private declared preferences. NULL means unanswered; no exact birthday or game/assessment score.';
comment on column public.user_preferences.age_range is
  'Optional personalization information, not a verified age or an access-control gate.';
comment on column public.user_preferences.gender is
  'Optional private information; not currently used for recommendations.';

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from public, anon, authenticated;
grant select on table public.user_preferences to authenticated;
grant update (age_range, gender, movie_knowledge_self_rating)
  on table public.user_preferences to authenticated;
grant all on table public.user_preferences to service_role;

create policy "Users can read their private preferences"
on public.user_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can update their private preferences"
on public.user_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
