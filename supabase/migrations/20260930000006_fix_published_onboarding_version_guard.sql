-- Replace the already-applied guard without rewriting its historical migration.
-- A statement may wait for a row lock across the scheduled publication time.
create or replace function private.guard_published_onboarding_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.published_at <= clock_timestamp() then
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
