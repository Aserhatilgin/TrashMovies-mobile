-- Forward-only weekly V1. Legacy daily tables/functions and shared calendar stay intact.
create table public.user_weekly_movie_collections (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  selected_on date not null check (selected_on between week_start and week_start + 6),
  preferences_revision bigint not null check (preferences_revision >= 0),
  algorithm_version smallint not null default 1 check (algorithm_version = 1),
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, week_start)
);
comment on table public.user_weekly_movie_collections is
  'Immutable first successful weekly snapshot, including weeks with zero eligible films. Istanbul Monday-Sunday; 30 calendar days of personal exposure exclusion.';
create table public.user_weekly_movie_items (
  user_id uuid not null,
  week_start date not null,
  position smallint not null check (position between 1 and 5),
  movie_id uuid not null references public.movies(id) on delete restrict,
  primary key (user_id, week_start, position),
  unique (user_id, week_start, movie_id),
  foreign key (user_id, week_start) references public.user_weekly_movie_collections(user_id, week_start) on delete cascade
);
create index user_weekly_movie_items_recent_idx on public.user_weekly_movie_items(user_id, movie_id, week_start);
alter table public.user_weekly_movie_collections enable row level security;
alter table public.user_weekly_movie_items enable row level security;
revoke all on public.user_weekly_movie_collections, public.user_weekly_movie_items from public, anon, authenticated;
grant select on public.user_weekly_movie_collections, public.user_weekly_movie_items to authenticated;
grant all on public.user_weekly_movie_collections, public.user_weekly_movie_items to service_role;
create policy "Users can read their weekly collections" on public.user_weekly_movie_collections
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can read their weekly films" on public.user_weekly_movie_items
  for select to authenticated using (user_id = (select auth.uid()));

-- No client clock parameter. This private clock is replaceable only by the DB
-- owner in rollback tests; API roles cannot invoke or change it.
create function private.weekly_movie_today() returns date language sql stable set search_path = '' as $$
  select (statement_timestamp() at time zone 'Europe/Istanbul')::date;
$$;
revoke all on function private.weekly_movie_today() from public, anon, authenticated, service_role;

create function public.get_weekly_movie_collection(p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  today date := private.weekly_movie_today();
  week_start_date date := today - (extract(isodow from today)::integer - 1);
  collection public.user_weekly_movie_collections%rowtype;
  taste jsonb;
  preferences jsonb;
  liked uuid[];
  disliked uuid[];
  negative_movies uuid[];
  positive_movies uuid[];
  items jsonb;
begin
  if caller_id is null or caller_id is distinct from p_expected_user_id then
    raise exception 'Authentication identity mismatch' using errcode = '28000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('weekly/' || caller_id::text || '/' || week_start_date::text, 0));
  select c.* into collection from public.user_weekly_movie_collections c
    where c.user_id = caller_id and c.week_start = week_start_date;
  if not found then
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

    -- Header and all items commit together. An empty header is also a completed
    -- snapshot: preference/pool changes cannot re-roll it during the same week.
    insert into public.user_weekly_movie_collections(user_id, week_start, selected_on, preferences_revision)
      values (caller_id, week_start_date, today, (taste ->> 'revision')::bigint) returning * into collection;
    with ranked as (
      select m.id,
        (select count(*) from public.movie_genres g where g.movie_id = m.id and g.genre_id = any(liked)) as liked_score,
        (select count(*) from public.movie_genres g where g.movie_id = m.id and exists (
          select 1 from public.movie_genres p where p.movie_id = any(positive_movies) and p.genre_id = g.genre_id)) as reaction_score,
        pg_catalog.md5(caller_id::text || '/' || week_start_date::text || '/' || m.id::text) as tie
      from public.movies m
      where m.daily_recommendation_eligible and not m.adult
        and not (m.id = any(negative_movies))
        and not exists (select 1 from public.movie_genres g where g.movie_id = m.id and g.genre_id = any(disliked))
        and not exists (select 1 from public.user_movie_interactions i where i.user_id = caller_id
          and i.movie_id = m.id and i.watched_at is not null)
        and not exists (select 1 from public.user_weekly_movie_items i
          join public.user_weekly_movie_collections c on c.user_id = i.user_id and c.week_start = i.week_start
          where i.user_id = caller_id and i.movie_id = m.id and c.week_start < week_start_date
            and c.selected_on between today - 30 and today)
        -- Include an old client's personal assignment made earlier TODAY too.
        and not exists (select 1 from public.user_daily_movie_assignments a
          where a.user_id = caller_id and a.movie_id = m.id and a.source = 'personal'
            and a.scheduled_date between today - 30 and today)
    ), chosen as (
      select * from ranked order by liked_score desc, reaction_score desc, tie, id limit 5
    )
    insert into public.user_weekly_movie_items(user_id, week_start, position, movie_id)
      select caller_id, week_start_date,
        (row_number() over (order by liked_score desc, reaction_score desc, tie, id))::smallint, id
      from chosen;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('position', i.position, 'movie', jsonb_build_object(
    'id', m.id, 'title', m.title, 'overview', m.overview, 'poster_path', m.poster_path, 'tmdb_rating', m.tmdb_rating
  )) order by i.position), '[]'::jsonb) into items
  from public.user_weekly_movie_items i join public.movies m on m.id = i.movie_id
  where i.user_id = caller_id and i.week_start = week_start_date;
  return jsonb_build_object('user_id', caller_id, 'week_start', week_start_date, 'week_end', week_start_date + 6,
    'selected_on', collection.selected_on, 'preferences_revision', collection.preferences_revision,
    'algorithm_version', collection.algorithm_version, 'status', case when jsonb_array_length(items) = 0 then 'empty' else 'ready' end,
    'items', items);
end;
$$;
revoke all on function public.get_weekly_movie_collection(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_weekly_movie_collection(uuid) to authenticated;
