-- Tier chosen at signup (maps to Stripe Price IDs in app env).

create type public.platform_plan_tier as enum ('starter', 'pro', 'business');

alter table public.tenant_billing_accounts
  add column platform_plan public.platform_plan_tier;

comment on column public.tenant_billing_accounts.platform_plan is
  'cleanScheduler platform subscription tier (Starter / Pro / Business).';
