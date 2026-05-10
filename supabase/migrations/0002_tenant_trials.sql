-- =============================================================================
-- 0002_tenant_trials.sql
-- =============================================================================
-- Adds tenant trial tracking for self-serve onboarding.

create type public.tenant_billing_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled'
);

create table public.tenant_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  status public.tenant_billing_status not null default 'trialing',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  activated_at timestamptz,
  canceled_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_billing_trial_window check (
    trial_started_at is null
    or trial_ends_at is null
    or trial_ends_at >= trial_started_at
  )
);

create index tenant_billing_accounts_status_idx
  on public.tenant_billing_accounts (status);

create trigger tenant_billing_accounts_set_updated_at
before update on public.tenant_billing_accounts
for each row execute procedure public.set_updated_at();

alter table public.tenant_billing_accounts enable row level security;

create policy "tenant_billing_accounts_member_read"
  on public.tenant_billing_accounts
  for select
  using (
    public.is_platform_admin()
    or public.has_tenant_membership(tenant_id)
  );

create policy "tenant_billing_accounts_admin_write"
  on public.tenant_billing_accounts
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
