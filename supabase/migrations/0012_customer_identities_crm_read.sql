-- =============================================================================
-- 0012_customer_identities_crm_read.sql
-- =============================================================================
-- Tenant CRM lists customers with embedded customer_identities. Ensure staff
-- with membership in that tenant can read identities linked via public.customers
-- (not only via customer_tenant_links), so nested PostgREST selects stay visible.

drop policy if exists "customer_identities_admin_or_owner_read" on public.customer_identities;

create policy "customer_identities_admin_or_owner_read"
  on public.customer_identities
  for select
  using (
    public.is_platform_admin()
    or auth_user_id = auth.uid()
    or exists (
      select 1
      from public.customer_tenant_links ctl
      where ctl.customer_identity_id = customer_identities.id
        and public.has_tenant_membership(ctl.tenant_id)
    )
    or exists (
      select 1
      from public.customers c
      where c.customer_identity_id = customer_identities.id
        and public.has_tenant_membership(c.tenant_id)
    )
  );
