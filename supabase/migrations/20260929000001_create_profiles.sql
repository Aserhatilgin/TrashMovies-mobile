-- Application presentation data. Private preferences belong in separate tables.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_key text not null default 'avatar_01',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_valid check (
    display_name is null or (
      display_name = btrim(display_name)
      and display_name !~ '^[[:space:]]|[[:space:]]$'
      and char_length(display_name) between 1 and 60
    )
  ),
  constraint profiles_avatar_key_valid check (
    avatar_key = btrim(avatar_key)
    and avatar_key !~ '^[[:space:]]|[[:space:]]$'
    and char_length(avatar_key) between 1 and 64
  )
);

comment on table public.profiles is
  'Application presentation only. Currently owner-readable; no email, demographics, preferences, onboarding, or scores.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_key) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "Users can read their profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Users can update their profile presentation"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Inserts are performed by initialize_user_domain(), not directly by clients.
