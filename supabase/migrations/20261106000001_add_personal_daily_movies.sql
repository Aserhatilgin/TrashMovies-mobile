-- Local V1 prototype. Eligibility is editorial, never inferred from a rating.
-- No catalog rows are enabled by this migration; the verified local fixture
-- enables only the 60 UUIDs in the supplied editorial manifest.
alter table public.movies add column daily_recommendation_eligible boolean not null default false;
comment on column public.movies.daily_recommendation_eligible is
  'Explicit editorial approval for the personal daily candidate pool. False by default.';

create table public.user_daily_movie_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  movie_id uuid not null references public.movies(id) on delete restrict,
  source text not null check (source in ('personal', 'shared')),
  preferences_revision bigint not null check (preferences_revision >= 0),
  algorithm_version smallint not null default 1 check (algorithm_version = 1),
  created_at timestamptz not null default now(),
  primary key (user_id, scheduled_date)
);
comment on table public.user_daily_movie_assignments is
  'Immutable successful daily assignments, keyed by authenticated user and server Europe/Istanbul date. No dependency on the shared calendar.';
create index user_daily_movie_assignments_recent_idx
  on public.user_daily_movie_assignments(user_id, movie_id, scheduled_date desc);
alter table public.user_daily_movie_assignments enable row level security;
revoke all on public.user_daily_movie_assignments from public, anon, authenticated;
grant select on public.user_daily_movie_assignments to authenticated;
grant all on public.user_daily_movie_assignments to service_role;
create policy "Users can read their daily assignments"
  on public.user_daily_movie_assignments for select to authenticated
  using (user_id = (select auth.uid()));

create function public.get_daily_movie_feed(p_expected_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  today date := (statement_timestamp() at time zone 'Europe/Istanbul')::date;
  assigned public.user_daily_movie_assignments%rowtype;
  candidate_id uuid;
  shared_id uuid;
  taste jsonb;
  preferences jsonb;
  liked uuid[];
  disliked uuid[];
  negative_movies uuid[];
  positive_movies uuid[];
  feed_status text := 'assigned';
  chosen_source text := 'personal';
  items jsonb;
begin
  if caller_id is null or caller_id is distinct from p_expected_user_id then
    raise exception 'Authentication identity mismatch' using errcode = '28000';
  end if;

  -- Serialize first requests before reading taste or selecting a candidate.
  -- Hash collisions only serialize unrelated requests; the PK is authoritative.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text || '/' || today::text, 0));
  select a.* into assigned from public.user_daily_movie_assignments a
    where a.user_id = caller_id and a.scheduled_date = today;

  if not found then
    -- One existing canonical snapshot of all current taste relations. An
    -- existing assignment returns without reading or invalidating this taste.
    taste := public.get_movie_taste();
    preferences := taste -> 'preferences';
    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into liked
      from jsonb_array_elements_text(preferences -> 'liked_genres') x;
    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into disliked
      from jsonb_array_elements_text(preferences -> 'disliked_genres') x;
    select coalesce(array_agg(e.key::uuid) filter (where e.value = '-1'::jsonb), '{}'::uuid[]),
      coalesce(array_agg(e.key::uuid) filter (where e.value = '1'::jsonb), '{}'::uuid[])
      into negative_movies, positive_movies
      from jsonb_each(preferences -> 'movie_reactions') e;

    select m.id into candidate_id from public.movies m
    where m.daily_recommendation_eligible and not m.adult
      and not (m.id = any(negative_movies))
      and not exists (select 1 from public.movie_genres g where g.movie_id = m.id and g.genre_id = any(disliked))
      and not exists (select 1 from public.user_movie_interactions i
        where i.user_id = caller_id and i.movie_id = m.id and i.watched_at is not null)
      and not exists (select 1 from public.user_daily_movie_assignments a
        where a.user_id = caller_id and a.movie_id = m.id and a.source = 'personal'
          and a.scheduled_date >= today - 30 and a.scheduled_date < today)
    order by
      (select count(*) from public.movie_genres g where g.movie_id = m.id and g.genre_id = any(liked)) desc,
      (select count(*) from public.movie_genres g where g.movie_id = m.id and exists (
        select 1 from public.movie_genres p where p.movie_id = any(positive_movies) and p.genre_id = g.genre_id)) desc,
      pg_catalog.md5(caller_id::text || '/' || today::text || '/' || m.id::text), m.id
    limit 1;

    if candidate_id is null then
      select d.movie_id into shared_id from public.daily_movies d where d.scheduled_date = today;
      if shared_id is null then
        feed_status := 'no_shared_movie';
      else
        -- Shared fallback deliberately retains explicit dislike/adult vetoes.
        -- Watched/recent exclusions apply to personal discovery, not fallback.
        select m.id into candidate_id from public.movies m where m.id = shared_id and not m.adult
          and not (m.id = any(negative_movies))
          and not exists (select 1 from public.movie_genres g where g.movie_id = m.id and g.genre_id = any(disliked));
        if candidate_id is null then feed_status := 'no_candidate';
        else chosen_source := 'shared'; end if;
      end if;
    end if;

    if candidate_id is not null then
      insert into public.user_daily_movie_assignments(user_id, scheduled_date, movie_id, source, preferences_revision)
      values (caller_id, today, candidate_id, chosen_source, (taste ->> 'revision')::bigint)
      returning * into assigned;
    end if;
  end if;

  -- Personal snapshots override the shared row on the same date. Preserve
  -- shared history on dates without a personal record; never backfill personal
  -- assignments or recompute historical taste. A missing today stays missing.
  with candidates as (
    select a.scheduled_date, a.movie_id, a.source, 0 as priority
      from public.user_daily_movie_assignments a where a.user_id = caller_id and a.scheduled_date <= today
    union all
    select d.scheduled_date, d.movie_id, 'shared', 1 from public.daily_movies d where d.scheduled_date < today
  ), unique_days as (
    select distinct on (c.scheduled_date) c.* from candidates c order by c.scheduled_date desc, c.priority
  ), recent as (
    select * from unique_days order by scheduled_date desc limit 30
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'scheduled_date', r.scheduled_date, 'source', r.source,
    'movie', jsonb_build_object('id', m.id, 'title', m.title, 'overview', m.overview,
      'poster_path', m.poster_path, 'tmdb_rating', m.tmdb_rating)
  ) order by r.scheduled_date), '[]'::jsonb) into items
  from recent r join public.movies m on m.id = r.movie_id;

  return jsonb_build_object('user_id', caller_id, 'today', today, 'status', feed_status, 'items', items);
end;
$$;
revoke all on function public.get_daily_movie_feed(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_daily_movie_feed(uuid) to authenticated;
