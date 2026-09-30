create table public.user_genre_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  genre_id uuid not null references public.genres (id) on delete restrict,
  preference smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_genre_preferences_pkey primary key (user_id, genre_id),
  constraint user_genre_preferences_preference_valid check (preference in (-1, 1))
);

comment on table public.user_genre_preferences is
  'Private declared genre preferences: -1 dislikes, 1 likes, and a missing row is neutral/unanswered.';

create index user_genre_preferences_genre_user_idx
  on public.user_genre_preferences (genre_id, user_id);

create trigger user_genre_preferences_set_updated_at
before update on public.user_genre_preferences
for each row execute function public.set_updated_at();

alter table public.user_genre_preferences enable row level security;
revoke all on table public.user_genre_preferences from public, anon, authenticated;
grant select, delete on table public.user_genre_preferences to authenticated;
grant insert (user_id, genre_id, preference)
  on table public.user_genre_preferences to authenticated;
grant update (preference) on table public.user_genre_preferences to authenticated;
grant all on table public.user_genre_preferences to service_role;

create policy "Users can read their genre preferences"
on public.user_genre_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can insert their genre preferences"
on public.user_genre_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their genre preferences"
on public.user_genre_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their genre preferences"
on public.user_genre_preferences for delete to authenticated
using (user_id = (select auth.uid()));
