create table public.onboarding_versions (
  version integer primary key,
  definition jsonb not null,
  published_at timestamptz not null default now(),

  constraint onboarding_versions_version_positive check (version > 0),
  constraint onboarding_versions_definition_object check (jsonb_typeof(definition) = 'object'),
  constraint onboarding_versions_definition_size check (octet_length(definition::text) <= 65536)
);

comment on table public.onboarding_versions is
  'Server-managed questionnaire definitions. The highest version published at or before server time is current. Publish the finalized v1 definition in a later migration; no placeholder is seeded.';

-- Existing drafts must keep the definition they were written against. Future
-- scheduled definitions remain editable until publication; published versions
-- are changed by inserting a new version rather than rewriting history.
create schema if not exists private;

create function private.guard_published_onboarding_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.published_at <= statement_timestamp() then
    if tg_op = 'DELETE' then
      raise exception 'Published onboarding versions cannot be deleted' using errcode = '55000';
    elsif new is distinct from old then
      raise exception 'Published onboarding versions are immutable' using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_published_onboarding_version()
  from public, anon, authenticated, service_role;

create trigger onboarding_versions_guard_publication
before update or delete on public.onboarding_versions
for each row execute function private.guard_published_onboarding_version();

alter table public.onboarding_versions enable row level security;
revoke all on table public.onboarding_versions from public, anon, authenticated;
grant select on table public.onboarding_versions to authenticated;
grant all on table public.onboarding_versions to service_role;

create policy "Authenticated users can read published onboarding definitions"
on public.onboarding_versions for select to authenticated
using (published_at <= now());

create table public.user_onboarding (
  user_id uuid not null references auth.users (id) on delete cascade,
  onboarding_version integer not null
    references public.onboarding_versions (version) on delete restrict,
  current_step text,
  responses jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  completion_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_onboarding_pkey primary key (user_id, onboarding_version),
  constraint user_onboarding_step_valid check (
    current_step is null or (
      current_step = btrim(current_step)
      and current_step !~ '^[[:space:]]|[[:space:]]$'
      and char_length(current_step) between 1 and 64
    )
  ),
  constraint user_onboarding_responses_object check (jsonb_typeof(responses) = 'object'),
  constraint user_onboarding_responses_size check (octet_length(responses::text) <= 32768),
  constraint user_onboarding_revision_nonnegative check (revision >= 0),
  constraint user_onboarding_completion_source_valid check (
    completion_source is null or completion_source in ('user', 'legacy_exemption')
  ),
  constraint user_onboarding_completion_pair check (
    (completed_at is null) = (completion_source is null)
  ),
  constraint user_onboarding_user_completion_started check (
    completion_source is distinct from 'user' or started_at is not null
  ),
  constraint user_onboarding_completion_order check (
    completed_at is null or started_at is null or completed_at >= started_at
  )
);

comment on table public.user_onboarding is
  'Private versioned drafts/completion. Only controlled RPCs mutate client-owned progress; database completion is authoritative.';

create index user_onboarding_version_user_idx
  on public.user_onboarding (onboarding_version, user_id);

create trigger user_onboarding_set_updated_at
before update on public.user_onboarding
for each row execute function public.set_updated_at();

alter table public.user_onboarding enable row level security;
revoke all on table public.user_onboarding from public, anon, authenticated;
grant select on table public.user_onboarding to authenticated;
grant all on table public.user_onboarding to service_role;

create policy "Users can read their onboarding"
on public.user_onboarding for select to authenticated
using (user_id = (select auth.uid()));
