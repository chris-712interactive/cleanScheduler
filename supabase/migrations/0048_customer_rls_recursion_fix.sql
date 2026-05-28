-- =============================================================================
-- 0048_customer_rls_recursion_fix.sql
-- =============================================================================
-- Break infinite RLS recursion between public.customers and
-- public.customer_identities:
--   customers_linked_identity_read → customer_identities (RLS)
--   customer_identities_admin_or_owner_read → customers (RLS) → loop
--
-- Use SECURITY DEFINER helpers so ownership / membership checks bypass RLS.

create or replace function public.auth_owns_customer_identity(p_customer_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_identities ci
    where ci.id = p_customer_identity_id
      and ci.auth_user_id = auth.uid()
  );
$$;

comment on function public.auth_owns_customer_identity(uuid) is
  'True when the signed-in auth user owns this global customer identity (portal customer).';

create or replace function public.auth_owns_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers c
    inner join public.customer_identities ci on ci.id = c.customer_identity_id
    where c.id = p_customer_id
      and ci.auth_user_id = auth.uid()
  );
$$;

comment on function public.auth_owns_customer(uuid) is
  'True when the signed-in auth user owns this per-tenant customer row.';

create or replace function public.tenant_member_can_read_customer_identity(p_customer_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_tenant_links ctl
    where ctl.customer_identity_id = p_customer_identity_id
      and public.has_tenant_membership(ctl.tenant_id)
  )
  or exists (
    select 1
    from public.customers c
    where c.customer_identity_id = p_customer_identity_id
      and public.has_tenant_membership(c.tenant_id)
  );
$$;

comment on function public.tenant_member_can_read_customer_identity(uuid) is
  'True when the signed-in user is tenant staff for a tenant linked to this identity.';

grant execute on function public.auth_owns_customer_identity(uuid) to authenticated;
grant execute on function public.auth_owns_customer(uuid) to authenticated;
grant execute on function public.tenant_member_can_read_customer_identity(uuid) to authenticated;

grant execute on function public.auth_owns_customer_identity(uuid) to service_role;
grant execute on function public.auth_owns_customer(uuid) to service_role;
grant execute on function public.tenant_member_can_read_customer_identity(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- customers: portal self-read (no nested RLS on customer_identities)
-- -----------------------------------------------------------------------------

drop policy if exists "customers_linked_identity_read" on public.customers;

create policy "customers_linked_identity_read"
  on public.customers
  for select
  using (public.auth_owns_customer_identity(customer_identity_id));

-- -----------------------------------------------------------------------------
-- customer_identities: tenant CRM read (no nested RLS on customers)
-- -----------------------------------------------------------------------------

drop policy if exists "customer_identities_admin_or_owner_read" on public.customer_identities;

create policy "customer_identities_admin_or_owner_read"
  on public.customer_identities
  for select
  using (
    public.is_platform_admin()
    or auth_user_id = auth.uid()
    or public.tenant_member_can_read_customer_identity(id)
  );

-- -----------------------------------------------------------------------------
-- Customer portal policies: replace customers ⨝ identities joins
-- -----------------------------------------------------------------------------

drop policy if exists "tenant_invoices_customer_read" on public.tenant_invoices;

create policy "tenant_invoices_customer_read"
  on public.tenant_invoices
  for select
  using (public.auth_owns_customer(customer_id));

drop policy if exists "tenant_invoice_payments_customer_read" on public.tenant_invoice_payments;

create policy "tenant_invoice_payments_customer_read"
  on public.tenant_invoice_payments
  for select
  using (
    exists (
      select 1
      from public.tenant_invoices inv
      where inv.id = tenant_invoice_payments.invoice_id
        and public.auth_owns_customer(inv.customer_id)
    )
  );

drop policy if exists "customer_support_threads_customer_rw" on public.customer_support_threads;

create policy "customer_support_threads_customer_rw"
  on public.customer_support_threads
  for select
  using (public.auth_owns_customer(customer_id));

drop policy if exists "customer_support_threads_customer_insert" on public.customer_support_threads;

create policy "customer_support_threads_customer_insert"
  on public.customer_support_threads
  for insert
  with check (public.auth_owns_customer(customer_id));

drop policy if exists "customer_support_messages_customer_rw" on public.customer_support_messages;

create policy "customer_support_messages_customer_rw"
  on public.customer_support_messages
  for select
  using (
    exists (
      select 1
      from public.customer_support_threads t
      where t.id = customer_support_messages.thread_id
        and public.auth_owns_customer(t.customer_id)
    )
  );

drop policy if exists "customer_support_messages_customer_insert" on public.customer_support_messages;

create policy "customer_support_messages_customer_insert"
  on public.customer_support_messages
  for insert
  with check (
    exists (
      select 1
      from public.customer_support_threads t
      where t.id = customer_support_messages.thread_id
        and public.auth_owns_customer(t.customer_id)
    )
  );

drop policy if exists "tenants_customer_linked_read" on public.tenants;

create policy "tenants_customer_linked_read"
  on public.tenants
  for select
  using (
    exists (
      select 1
      from public.customers c
      where c.tenant_id = tenants.id
        and public.auth_owns_customer_identity(c.customer_identity_id)
    )
  );

drop policy if exists "service_plans_customer_read" on public.service_plans;

create policy "service_plans_customer_read"
  on public.service_plans
  for select
  using (
    exists (
      select 1
      from public.customer_subscriptions cs
      where cs.service_plan_id = service_plans.id
        and public.auth_owns_customer(cs.customer_id)
    )
  );

drop policy if exists "customer_subscriptions_customer_read" on public.customer_subscriptions;

create policy "customer_subscriptions_customer_read"
  on public.customer_subscriptions
  for select
  using (public.auth_owns_customer(customer_id));

drop policy if exists "visit_reschedule_requests_customer_read" on public.visit_reschedule_requests;

create policy "visit_reschedule_requests_customer_read"
  on public.visit_reschedule_requests
  for select
  using (public.auth_owns_customer(customer_id));

drop policy if exists "visit_reschedule_requests_customer_insert" on public.visit_reschedule_requests;

create policy "visit_reschedule_requests_customer_insert"
  on public.visit_reschedule_requests
  for insert
  with check (public.auth_owns_customer(customer_id));
