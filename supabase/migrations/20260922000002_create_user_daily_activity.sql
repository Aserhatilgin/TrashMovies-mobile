create table public.user_daily_activity (
  user_id uuid not null,
  activity_date date not null,
  created_at timestamptz not null default now(),

  constraint user_daily_activity_pkey primary key (user_id, activity_date),
  constraint user_daily_activity_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade
);

comment on column public.user_daily_activity.activity_date is
  'Calendar date in Europe/Istanbul. Consecutive dates form a streak; a missing date breaks it. Every 7 consecutive days is a weekly milestone. Activity history is the source of truth, so current_streak is derived rather than stored.';

alter table public.user_daily_activity enable row level security;

revoke all on table public.user_daily_activity from anon, authenticated;
grant select on table public.user_daily_activity to authenticated;

create policy "Users can read their daily activity"
on public.user_daily_activity
for select to authenticated
using (user_id = (select auth.uid()));

create function public.record_daily_activity()
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  today_in_istanbul date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.user_daily_activity (user_id, activity_date)
  values (current_user_id, today_in_istanbul)
  on conflict (user_id, activity_date) do nothing;

  return today_in_istanbul;
end;
$$;

revoke all on function public.record_daily_activity() from public, anon, authenticated;
grant execute on function public.record_daily_activity() to authenticated;
