-- =============================================================================
-- 0124_user_profiles_privileged_columns.sql
-- A signed-in user can update their own user_profiles row (policy
-- user_profiles_self_update). Table UPDATE was never revoked from
-- authenticated, so PostgREST could change app_role. Platform identity is
-- Auth app_metadata, written by service_role. This migration does not demote
-- existing rows.
-- =============================================================================

revoke update on table public.user_profiles from public;
revoke update on table public.user_profiles from anon;
revoke update on table public.user_profiles from authenticated;

grant update (
  display_name,
  first_name,
  last_name,
  avatar_url
) on table public.user_profiles to authenticated;

grant select, insert, update, delete on table public.user_profiles to service_role;

comment on column public.user_profiles.app_role is
  'Server-written copy of Auth app_metadata.app_role. Clients cannot update it.';

comment on policy "user_profiles_self_update" on public.user_profiles is
  'Own-row update stays allowed for display columns. app_role, user_id, and created_at are not client-writable.';

create or replace function public.user_profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.app_role is distinct from old.app_role
     or new.created_at is distinct from old.created_at then
    raise exception 'user_profiles privileged columns are managed by the server'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists user_profiles_guard_privileged_columns on public.user_profiles;

create trigger user_profiles_guard_privileged_columns
before update on public.user_profiles
for each row
execute procedure public.user_profiles_guard_privileged_columns();
