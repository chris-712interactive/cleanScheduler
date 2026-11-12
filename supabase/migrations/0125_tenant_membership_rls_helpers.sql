-- =============================================================================
-- 0125_tenant_membership_rls_helpers.sql
-- =============================================================================
-- A signed-in tenant member reading public.tenant_quotes through PostgREST
-- got HTTP 403. The SELECT policy calls public.has_tenant_membership(tenant_id).
-- That helper was SECURITY INVOKER and reads public.tenant_memberships.
-- authenticated has no SELECT grant on tenant_memberships, so Postgres raises
-- 42501 inside the policy and PostgREST turns that into 403.
--
-- Granting SELECT on tenant_memberships to authenticated is the wrong fix.
-- The membership table's own read policy calls has_tenant_membership, so an
-- invoker helper would recurse. Keep the table grant limited to service_role.
--
-- Recreate the helper as SECURITY DEFINER, owned by the migration role (the
-- table owner, which bypasses RLS on tenant_memberships). The body is unchanged:
-- true only when auth.uid() has an active membership in that tenant.
-- search_path is pinned to public. auth.uid() stays schema-qualified.
--
-- is_platform_admin() and current_app_role() only read auth.jwt(). They do not
-- touch a table authenticated cannot read, so they stay invoker.
-- is_tenant_owner_or_admin() has the same shape but platform_support_tickets
-- and platform_support_messages are not granted to authenticated (service_role
-- bypasses RLS), so a member REST read never evaluates it.
--
-- can_read_hiring_desk() is on the member path: hiring tables grant SELECT to
-- authenticated and the helper reads tenant_memberships and
-- tenant_role_permissions. Same 42501. Same definer treatment. The predicate
-- is unchanged (platform admin, or an active owner/admin, or hiring.view /
-- hiring.manage on the caller's own membership).

create or replace function public.has_tenant_membership(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
  );
$$;

alter function public.has_tenant_membership(uuid) security definer;
alter function public.has_tenant_membership(uuid) set search_path = public;

comment on function public.has_tenant_membership(uuid) is
  'True when auth.uid() has an active membership in the tenant. Security definer so RLS can read tenant_memberships without granting that table to authenticated.';

revoke all on function public.has_tenant_membership(uuid) from public;
revoke all on function public.has_tenant_membership(uuid) from anon;
grant execute on function public.has_tenant_membership(uuid) to authenticated;
grant execute on function public.has_tenant_membership(uuid) to service_role;

create or replace function public.can_read_hiring_desk(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = target_tenant_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
        and (
          tm.role in ('owner', 'admin')
          or exists (
            select 1
            from public.tenant_role_permissions trp
            where trp.role_id = tm.role_id
              and trp.permission_key in ('hiring.view', 'hiring.manage')
          )
        )
    );
$$;

alter function public.can_read_hiring_desk(uuid) security definer;
alter function public.can_read_hiring_desk(uuid) set search_path = public;

comment on function public.can_read_hiring_desk(uuid) is
  'True when auth.uid() may read this tenant''s hiring desk. Security definer so the membership and permission lookups do not require table grants for authenticated.';

revoke all on function public.can_read_hiring_desk(uuid) from public;
revoke all on function public.can_read_hiring_desk(uuid) from anon;
grant execute on function public.can_read_hiring_desk(uuid) to authenticated;
grant execute on function public.can_read_hiring_desk(uuid) to service_role;

do $$
declare
  helper record;
begin
  for helper in
    select *
    from (
      values
        ('has_tenant_membership'::text),
        ('can_read_hiring_desk'::text)
    ) as helpers(name)
  loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = helper.name
        and pg_get_function_identity_arguments(p.oid) = 'target_tenant_id uuid'
        and p.prosecdef
        and exists (
          select 1
          from unnest(coalesce(p.proconfig, array[]::text[])) cfg
          where cfg = 'search_path=public'
        )
    ) then
      raise exception '% must be security definer with search_path=public', helper.name;
    end if;
  end loop;
end $$;
