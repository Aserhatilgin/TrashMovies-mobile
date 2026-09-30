-- Membership/order is published with the version in a later migration.
-- Approved V1 order (TMDB ID -> existing public.movies UUID):
-- 155    -> e2e3b400-5219-4d69-a706-ff05653825c5
-- 157336 -> d44bc6b1-292c-4a81-90fb-97988d98c637
-- 138843 -> fd26ec0a-994b-4fc8-bc55-0fcbc04345cd
-- 313369 -> 627a80f2-3e6a-4538-ac89-c3b1f83007ba
-- 120467 -> aa821107-d51b-4475-a599-bec9354ab268
-- 496243 -> 6b66e3f1-e3a6-4c39-8bfb-02ed6cb9089c
-- 129    -> 82c25ab2-e421-47cf-984a-3172f143930d
-- 238    -> 8b111814-f391-4497-bf01-4b3b55b3d22d
-- 37165  -> 3fead38d-8fa0-4c9e-b092-a9ca9df23890
-- 76341  -> 6c336121-7304-4785-99e3-28975c0bfa22
-- 244786 -> 5bebc825-41fe-426b-800b-ae29c9df40e9
-- 11036  -> fb7002f0-477f-434a-bf10-3beb456e1cfd
-- 419430 -> 0cd23787-7568-4160-aabe-3db5b4f54d17
-- 545611 -> ab81b28e-5e9c-49ac-9894-b3d7f59b7629
-- 17473  -> 685617d6-9ada-47a0-8871-03a6d6e6447e
create table public.onboarding_version_movies (
  onboarding_version integer not null
    references public.onboarding_versions (version) on delete restrict,
  position smallint not null check (position > 0),
  movie_id uuid not null references public.movies (id) on delete restrict,

  constraint onboarding_version_movies_pkey primary key (onboarding_version, position),
  constraint onboarding_version_movies_movie_unique unique (onboarding_version, movie_id)
);

comment on table public.onboarding_version_movies is
  'Server-managed curated movie membership and order for each onboarding version. V1 rows are inserted only by its future publish migration.';

-- Once a version is published, its movie set must remain interpretable for
-- historical responses. A future publish migration should create a scheduled
-- version, insert all movie rows, then publish it in the same transaction.
create function private.guard_published_onboarding_movie()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  publication_time timestamptz;
begin
  if tg_op = 'INSERT' then
    select v.published_at into publication_time from public.onboarding_versions as v
    where v.version = new.onboarding_version
    for share;
    if publication_time <= clock_timestamp() then
      raise exception 'Published onboarding movie sets are immutable'
        using errcode = '55000';
    end if;
  elsif tg_op = 'DELETE' then
    select v.published_at into publication_time from public.onboarding_versions as v
    where v.version = old.onboarding_version
    for share;
    if publication_time <= clock_timestamp() then
      raise exception 'Published onboarding movie sets are immutable'
        using errcode = '55000';
    end if;
  else
    for publication_time in
      select v.published_at from public.onboarding_versions as v
      where v.version in (old.onboarding_version, new.onboarding_version)
      for share
    loop
      if publication_time <= clock_timestamp() then
        raise exception 'Published onboarding movie sets are immutable'
          using errcode = '55000';
      end if;
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_published_onboarding_movie()
  from public, anon, authenticated, service_role;

create trigger onboarding_version_movies_guard_publication
before insert or update or delete on public.onboarding_version_movies
for each row execute function private.guard_published_onboarding_movie();

create index onboarding_version_movies_movie_idx
  on public.onboarding_version_movies (movie_id);

alter table public.onboarding_version_movies enable row level security;
revoke all on table public.onboarding_version_movies from public, anon, authenticated;
grant select on table public.onboarding_version_movies to authenticated;
grant all on table public.onboarding_version_movies to service_role;

-- The app can join this relation to public.movies for the published survey.
create policy "Authenticated users can read published onboarding movie sets"
on public.onboarding_version_movies for select to authenticated
using (exists (
  select 1 from public.onboarding_versions as v
  where v.version = onboarding_version
    and v.published_at <= now()
));
