create table public.user_movie_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete cascade,
  preference smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_movie_preferences_pkey primary key (user_id, movie_id),
  constraint user_movie_preferences_preference_valid check (preference in (-1, 1))
);

comment on table public.user_movie_preferences is
  'Private declared taste reactions. Missing row means neutral or unknown; saved/watched/rating state remains in user_movie_interactions.';

create index user_movie_preferences_movie_preference_user_idx
  on public.user_movie_preferences (movie_id, preference, user_id);

create trigger user_movie_preferences_set_updated_at
before update on public.user_movie_preferences
for each row execute function public.set_updated_at();

alter table public.user_movie_preferences enable row level security;
revoke all on table public.user_movie_preferences from public, anon, authenticated;
grant select on table public.user_movie_preferences to authenticated;
grant all on table public.user_movie_preferences to service_role;

create policy "Users can read their declared movie preferences"
on public.user_movie_preferences for select to authenticated
using (user_id = (select auth.uid()));
