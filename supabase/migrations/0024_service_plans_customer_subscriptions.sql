-- =============================================================================
-- 0024_service_plans_customer_subscriptions.sql
-- =============================================================================
-- Recurring service plans per tenant and end-customer Stripe Subscriptions on
-- the tenant's Connect Express account. Maps Stripe Customer per (tenant,
-- customers row) for repeat Checkout.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.service_plan_billing_interval as enum ('week', 'month', 'year');

create type public.tenant_customer_subscription_status as enum (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.service_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  billing_interval public.service_plan_billing_interval not null default 'month',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_plans_tenant_active_idx
  on public.service_plans (tenant_id, is_active, created_at desc);

create trigger service_plans_set_updated_at
before update on public.service_plans
for each row execute procedure public.set_updated_at();

create table public.tenant_customer_stripe_customers (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, customer_id)
);

create unique index tenant_customer_stripe_customers_stripe_uidx
  on public.tenant_customer_stripe_customers (stripe_customer_id);

create trigger tenant_customer_stripe_customers_set_updated_at
before update on public.tenant_customer_stripe_customers
for each row execute procedure public.set_updated_at();

create table public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_plan_id uuid not null references public.service_plans(id) on delete restrict,
  status public.tenant_customer_subscription_status not null default 'incomplete',
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_subscriptions_tenant_customer_idx
  on public.customer_subscriptions (tenant_id, customer_id, created_at desc);

create index customer_subscriptions_stripe_idx
  on public.customer_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create trigger customer_subscriptions_set_updated_at
before update on public.customer_subscriptions
for each row execute procedure public.set_updated_at();

create or replace function public.enforce_customer_subscriptions_tenant_match()
returns trigger
language plpgsql
as $$
declare
  c_tid uuid;
  p_tid uuid;
begin
  select tenant_id into c_tid from public.customers where id = new.customer_id;
  if c_tid is null or c_tid <> new.tenant_id then
    raise exception 'customer_subscriptions: customer tenant mismatch';
  end if;
  select tenant_id into p_tid from public.service_plans where id = new.service_plan_id;
  if p_tid is null or p_tid <> new.tenant_id then
    raise exception 'customer_subscriptions: service plan tenant mismatch';
  end if;
  return new;
end;
$$;

create trigger customer_subscriptions_enforce_tenant
before insert or update of tenant_id, customer_id, service_plan_id on public.customer_subscriptions
for each row execute procedure public.enforce_customer_subscriptions_tenant_match();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.service_plans enable row level security;

create policy "service_plans_member_all"
  on public.service_plans
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "service_plans_customer_read"
  on public.service_plans
  for select
  using (
    exists (
      select 1
      from public.customer_subscriptions cs
      join public.customers c on c.id = cs.customer_id
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where cs.service_plan_id = service_plans.id
        and ci.auth_user_id = auth.uid()
    )
  );

alter table public.tenant_customer_stripe_customers enable row level security;

create policy "tenant_customer_stripe_customers_member_all"
  on public.tenant_customer_stripe_customers
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

alter table public.customer_subscriptions enable row level security;

create policy "customer_subscriptions_member_all"
  on public.customer_subscriptions
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "customer_subscriptions_customer_read"
  on public.customer_subscriptions
  for select
  using (
    exists (
      select 1
      from public.customers c
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where c.id = customer_subscriptions.customer_id
        and ci.auth_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Service role
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on table public.service_plans to service_role;
grant select, insert, update, delete on table public.tenant_customer_stripe_customers to service_role;
grant select, insert, update, delete on table public.customer_subscriptions to service_role;

revoke all on table public.tenant_customer_stripe_customers from anon;
