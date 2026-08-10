-- Replace the disposable connection-test table with the TrashMovies catalog.
-- No dependent objects exist in the captured remote baseline, so CASCADE is
-- intentionally omitted.
drop table public.movies;

-- TrashMovies movie catalog and global Movie of the Day schedule.
-- A daily_movies.scheduled_date value is interpreted in Europe/Istanbul.

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null unique,
  imdb_id text unique,
  title text not null,
  original_title text not null,
  overview text not null,
  poster_path text not null,
  backdrop_path text,
  release_date date,
  original_language text,
  tmdb_rating numeric(4, 2),
  tmdb_vote_count integer not null default 0,
  imdb_rating numeric(3, 1),
  popularity numeric,
  adult boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint movies_tmdb_id_positive check (tmdb_id > 0),
  constraint movies_imdb_id_not_blank check (imdb_id is null or btrim(imdb_id) <> ''),
  constraint movies_title_not_blank check (btrim(title) <> ''),
  constraint movies_original_title_not_blank check (btrim(original_title) <> ''),
  constraint movies_overview_not_blank check (btrim(overview) <> ''),
  constraint movies_poster_path_not_blank check (btrim(poster_path) <> ''),
  constraint movies_tmdb_rating_range check (
    tmdb_rating is null or tmdb_rating between 0 and 10
  ),
  constraint movies_tmdb_vote_count_nonnegative check (tmdb_vote_count >= 0),
  constraint movies_imdb_rating_range check (
    imdb_rating is null or imdb_rating between 0 and 10
  ),
  constraint movies_popularity_nonnegative check (popularity is null or popularity >= 0)
);

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint genres_tmdb_id_positive check (tmdb_id > 0),
  constraint genres_name_not_blank check (btrim(name) <> ''),
  constraint genres_slug_not_blank check (btrim(slug) <> '')
);

create table public.movie_genres (
  movie_id uuid not null,
  genre_id uuid not null,

  constraint movie_genres_pkey primary key (movie_id, genre_id),
  constraint movie_genres_movie_id_fkey
    foreign key (movie_id)
    references public.movies (id)
    on delete cascade,
  constraint movie_genres_genre_id_fkey
    foreign key (genre_id)
    references public.genres (id)
    on delete restrict
);

create index movie_genres_genre_id_movie_id_idx
  on public.movie_genres (genre_id, movie_id);

create table public.daily_movies (
  scheduled_date date primary key,
  movie_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_movies_movie_id_fkey
    foreign key (movie_id)
    references public.movies (id)
    on delete restrict
);

comment on table public.daily_movies is
  'Global Movie of the Day schedule shared by all users.';

comment on column public.daily_movies.scheduled_date is
  'Calendar date interpreted in the Europe/Istanbul application timezone.';

create index daily_movies_movie_id_idx
  on public.daily_movies (movie_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger movies_set_updated_at
before update on public.movies
for each row execute function public.set_updated_at();

create trigger genres_set_updated_at
before update on public.genres
for each row execute function public.set_updated_at();

create trigger daily_movies_set_updated_at
before update on public.daily_movies
for each row execute function public.set_updated_at();

alter table public.movies enable row level security;
alter table public.genres enable row level security;
alter table public.movie_genres enable row level security;
alter table public.daily_movies enable row level security;

revoke all on table public.movies from anon, authenticated;
revoke all on table public.genres from anon, authenticated;
revoke all on table public.movie_genres from anon, authenticated;
revoke all on table public.daily_movies from anon, authenticated;

grant select on table public.movies to authenticated;
grant select on table public.genres to authenticated;
grant select on table public.movie_genres to authenticated;
grant select on table public.daily_movies to authenticated;

create policy "Authenticated users can read movies"
on public.movies
for select
to authenticated
using (true);

create policy "Authenticated users can read genres"
on public.genres
for select
to authenticated
using (true);

create policy "Authenticated users can read movie genres"
on public.movie_genres
for select
to authenticated
using (true);

create policy "Authenticated users can read daily movies"
on public.daily_movies
for select
to authenticated
using (true);
