-- =============================================================================
-- 0001_dev_smoke_seed.sql
-- =============================================================================
-- Purpose:
--   Quick DEV smoke-test seed so portal auth guards can pass.
--
-- What it does:
--   1) Sets app_role='admin' on one existing auth user
--   2) Upserts user_profiles row for that user
--   3) Upserts tenant 'acme' (or your chosen slug)
--   4) Upserts tenant_memberships owner/admin link for that user
--   5) Creates one customer identity + customer + link for demo data
--
-- Before running:
--   - Create user in Supabase Auth UI first (email/password)
--   - Replace the values in the params CTE below
--
-- Run in Supabase SQL Editor.

with params as (
  select
    'chris+acme@cleanscheduler.com'::text as target_email,
    'acme'::text as tenant_slug,
    'Acme Cleaning Co'::text as tenant_name,
    'owner'::public.tenant_role as tenant_role,
    'Admin User'::text as display_name
),
selected_user as (
  select au.id as user_id, p.*
  from auth.users au
  cross join params p
  where lower(au.email) = lower(p.target_email)
),
updated_auth as (
  update auth.users au
  set raw_app_meta_data = coalesce(au.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'app_role', 'admin',
    'tenant_role', (select tenant_role::text from params),
    'current_tenant_id', coalesce((
      select t.id::text
      from public.tenants t
      where t.slug = (select tenant_slug from params)
      limit 1
    ), '')
  )
  where au.id in (select user_id from selected_user)
  returning au.id as user_id
),
upsert_profile as (
  insert into public.user_profiles (user_id, app_role, display_name)
  select su.user_id, 'admin'::public.app_role, su.display_name
  from selected_user su
  on conflict (user_id)
  do update set
    app_role = excluded.app_role,
    display_name = excluded.display_name,
    updated_at = now()
  returning user_id
),
upsert_tenant as (
  insert into public.tenants (slug, name)
  select p.tenant_slug, p.tenant_name
  from params p
  on conflict (slug)
  do update set
    name = excluded.name,
    updated_at = now()
  returning id, slug, name
),
resolved_tenant as (
  select t.id, t.slug, t.name
  from public.tenants t
  where t.slug = (select tenant_slug from params)
  limit 1
),
upsert_membership as (
  insert into public.tenant_memberships (tenant_id, user_id, role, is_active)
  select rt.id, su.user_id, p.tenant_role, true
  from resolved_tenant rt
  cross join selected_user su
  cross join params p
  on conflict (tenant_id, user_id)
  do update set
    role = excluded.role,
    is_active = true,
    updated_at = now()
  returning tenant_id, user_id
),
insert_customer_identity as (
  insert into public.customer_identities (auth_user_id, email, full_name, phone)
  select null, 'demo.customer@example.com', 'Demo Customer', '+1 (555) 555-0101'
  where not exists (
    select 1
    from public.customer_identities ci
    where lower(coalesce(ci.email, '')) = 'demo.customer@example.com'
  )
  returning id
),
resolved_customer_identity as (
  select ci.id
  from public.customer_identities ci
  where lower(coalesce(ci.email, '')) = 'demo.customer@example.com'
  limit 1
),
upsert_customer as (
  insert into public.customers (tenant_id, customer_identity_id, status)
  select rt.id, rci.id, 'active'
  from resolved_tenant rt
  cross join resolved_customer_identity rci
  on conflict (tenant_id, customer_identity_id)
  do update set
    status = excluded.status,
    updated_at = now()
  returning id, tenant_id, customer_identity_id
)
insert into public.customer_tenant_links (
  customer_identity_id,
  tenant_id,
  customer_id,
  is_primary
)
select
  uc.customer_identity_id,
  uc.tenant_id,
  uc.id,
  true
from upsert_customer uc
on conflict (customer_identity_id, tenant_id)
do update set
  customer_id = excluded.customer_id,
  is_primary = true;

-- Optional sanity checks:
-- select * from public.user_profiles;
-- select * from public.tenants;
-- select * from public.tenant_memberships;
-- select * from public.customers;
