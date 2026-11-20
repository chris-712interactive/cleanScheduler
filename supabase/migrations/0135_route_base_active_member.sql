-- Office writes on tenant_cleaner_route_bases must name an active member.
-- 0134 lets an owner or admin insert or update any user_id on their tenant.
-- The server action already rejects that. This closes the PostgREST path.
-- Apply by hand after 0134. Safe to run again. Do not apply from an agent.
-- Does not change the same-tenant place foreign keys or release_route_location_bases.

create or replace function public.route_base_subject_is_active_member(
  target_tenant_id uuid,
  target_user_id uuid
)
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
      and tm.user_id = target_user_id
      and tm.is_active = true
  );
$$;

comment on function public.route_base_subject_is_active_member(uuid, uuid) is
  'True when target_user_id is an active member of target_tenant_id. Security definer so route-base RLS can read memberships without a table grant.';

revoke all on function public.route_base_subject_is_active_member(uuid, uuid) from public;
revoke all on function public.route_base_subject_is_active_member(uuid, uuid) from anon;
grant execute on function public.route_base_subject_is_active_member(uuid, uuid) to authenticated;
grant execute on function public.route_base_subject_is_active_member(uuid, uuid) to service_role;

drop policy if exists tenant_cleaner_route_bases_office on public.tenant_cleaner_route_bases;

create policy tenant_cleaner_route_bases_office
  on public.tenant_cleaner_route_bases
  for all
  to authenticated
  using (public.can_manage_route_office(tenant_id))
  with check (
    public.can_manage_route_office(tenant_id)
    and public.route_base_subject_is_active_member(tenant_id, user_id)
  );

comment on policy tenant_cleaner_route_bases_office on public.tenant_cleaner_route_bases is
  'Office can read every base in the tenant. Insert and update require the subject to be an active member.';
