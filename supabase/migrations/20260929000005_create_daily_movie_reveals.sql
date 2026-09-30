create table public.user_daily_movie_reveals (
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_date date not null references public.daily_movies (scheduled_date) on delete restrict,
  revealed_at timestamptz not null default now(),

  constraint user_daily_movie_reveals_pkey primary key (user_id, scheduled_date)
);

comment on table public.user_daily_movie_reveals is
  'Movie-of-the-Day reveal history, the source of Home streaks. A reveal is recorded only by record_daily_movie_reveal(), using the server Europe/Istanbul date.';

create index user_daily_movie_reveals_date_user_idx
  on public.user_daily_movie_reveals (scheduled_date, user_id);

alter table public.user_daily_movie_reveals enable row level security;
revoke all on table public.user_daily_movie_reveals from public, anon, authenticated;
grant select on table public.user_daily_movie_reveals to authenticated;
grant all on table public.user_daily_movie_reveals to service_role;

create policy "Users can read their daily movie reveals"
on public.user_daily_movie_reveals for select to authenticated
using (user_id = (select auth.uid()));

-- user_daily_activity and record_daily_activity() continue to represent app
-- activity. They neither insert reveal rows nor contribute to reveal streaks.
comment on table public.user_daily_activity is
  'General active app days, used for Profile total active days. Home reveal streaks come from user_daily_movie_reveals.';
comment on column public.user_daily_activity.activity_date is
  'Calendar date in Europe/Istanbul for general app activity; opening the app does not create a Movie-of-the-Day reveal.';
