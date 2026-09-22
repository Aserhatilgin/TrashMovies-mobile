create table public.user_movie_interactions (
  user_id uuid not null,
  movie_id uuid not null,
  saved_at timestamptz,
  watched_at timestamptz,
  rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_movie_interactions_pkey primary key (user_id, movie_id),
  constraint user_movie_interactions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint user_movie_interactions_movie_id_fkey
    foreign key (movie_id) references public.movies (id) on delete cascade,
  constraint user_movie_interactions_rating_range
    check (rating is null or rating between 1 and 10),
  constraint user_movie_interactions_rating_requires_watched
    check (rating is null or watched_at is not null),
  constraint user_movie_interactions_has_state
    check (saved_at is not null or watched_at is not null)
);

create index user_movie_interactions_saved_idx
  on public.user_movie_interactions (user_id, saved_at desc)
  where saved_at is not null;

create index user_movie_interactions_watched_idx
  on public.user_movie_interactions (user_id, watched_at desc)
  where watched_at is not null;

create trigger user_movie_interactions_set_updated_at
before update on public.user_movie_interactions
for each row execute function public.set_updated_at();

alter table public.user_movie_interactions enable row level security;

revoke all on table public.user_movie_interactions from anon, authenticated;
grant select, delete on table public.user_movie_interactions to authenticated;
grant insert (user_id, movie_id, saved_at, watched_at, rating)
  on table public.user_movie_interactions to authenticated;
-- Column-level UPDATE prevents changing either identity or the audit timestamps.
grant update (saved_at, watched_at, rating)
  on table public.user_movie_interactions to authenticated;

create policy "Users can read their movie interactions"
on public.user_movie_interactions
for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can insert their movie interactions"
on public.user_movie_interactions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their movie interactions"
on public.user_movie_interactions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their movie interactions"
on public.user_movie_interactions
for delete to authenticated
using (user_id = (select auth.uid()));
