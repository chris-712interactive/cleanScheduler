-- Subscription charges can cover a fixed number of cleans. Visit completion,
-- failed charges, and makeups read these rows. Plans with included_cleans null
-- keep billing every visit on its own.

create type public.service_plan_cadence as enum ('weekly', 'biweekly', 'monthly');

create type public.subscription_coverage_grant_status as enum ('open', 'disputed', 'reversed');

create type public.visit_coverage_status as enum ('covered', 'waiting', 'makeup');

create type public.visit_coverage_cancel_party as enum ('company', 'customer');

alter table public.service_plans
  add column if not exists included_cleans integer,
  add column if not exists service_cadence public.service_plan_cadence,
  add column if not exists overage_amount_cents integer;

alter table public.service_plans
  drop constraint if exists service_plans_included_cleans_pos,
  drop constraint if exists service_plans_overage_pos;

alter table public.service_plans
  add constraint service_plans_included_cleans_pos check (included_cleans is null or included_cleans > 0),
  add constraint service_plans_overage_pos check (overage_amount_cents is null or overage_amount_cents > 0);

comment on column public.service_plans.included_cleans is
  'Service visits one successful charge covers. Null keeps visit-by-visit billing.';

comment on column public.service_plans.overage_amount_cents is
  'Price of a clean past the grant. Null uses the visit price.';

alter table public.customer_subscriptions
  add column if not exists property_id uuid references public.tenant_customer_properties (id) on delete restrict;

create unique index if not exists customer_subscriptions_one_open_property_idx
  on public.customer_subscriptions (property_id)
  where property_id is not null
    and status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused');

comment on column public.customer_subscriptions.property_id is
  'Home this subscription covers. Null only when the customer had a single property at checkout.';

create table if not exists public.subscription_coverage_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_subscription_id uuid not null references public.customer_subscriptions (id) on delete cascade,
  stripe_invoice_id text,
  tenant_invoice_id uuid references public.tenant_invoices (id) on delete set null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  included_cleans integer not null check (included_cleans > 0),
  overage_amount_cents integer,
  coverage_ends_on date,
  status public.subscription_coverage_grant_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_coverage_grants_period check (period_end > period_start),
  constraint subscription_coverage_grants_overage_pos check (
    overage_amount_cents is null or overage_amount_cents > 0
  )
);

create unique index if not exists subscription_coverage_grants_stripe_invoice_uidx
  on public.subscription_coverage_grants (stripe_invoice_id)
  where stripe_invoice_id is not null;

create index if not exists subscription_coverage_grants_subscription_idx
  on public.subscription_coverage_grants (customer_subscription_id, period_start desc);

drop trigger if exists subscription_coverage_grants_set_updated_at on public.subscription_coverage_grants;
create trigger subscription_coverage_grants_set_updated_at
before update on public.subscription_coverage_grants
for each row execute procedure public.set_updated_at();

create table if not exists public.subscription_coverage_makeups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_subscription_id uuid not null references public.customer_subscriptions (id) on delete cascade,
  source_visit_id uuid references public.tenant_scheduled_visits (id) on delete set null,
  source_grant_id uuid references public.subscription_coverage_grants (id) on delete set null,
  consumed_visit_id uuid references public.tenant_scheduled_visits (id) on delete set null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscription_coverage_makeups_open_idx
  on public.subscription_coverage_makeups (customer_subscription_id)
  where consumed_visit_id is null and dismissed_at is null;

create table if not exists public.subscription_coverage_forfeits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_subscription_id uuid not null references public.customer_subscriptions (id) on delete cascade,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_coverage_forfeits_subscription_idx
  on public.subscription_coverage_forfeits (customer_subscription_id, starts_at);

alter table public.tenant_scheduled_visits
  add column if not exists coverage_status public.visit_coverage_status,
  add column if not exists coverage_grant_id uuid references public.subscription_coverage_grants (id) on delete set null,
  add column if not exists coverage_makeup_id uuid references public.subscription_coverage_makeups (id) on delete set null,
  add column if not exists coverage_cancel_party public.visit_coverage_cancel_party,
  add column if not exists coverage_addon_invoice_id uuid references public.tenant_invoices (id) on delete set null;

comment on column public.tenant_scheduled_visits.coverage_status is
  'covered and waiting belong to a subscription grant. makeup is a company-owed clean.';

alter table public.subscription_coverage_grants enable row level security;
alter table public.subscription_coverage_makeups enable row level security;
alter table public.subscription_coverage_forfeits enable row level security;

drop policy if exists "subscription_coverage_grants_member_all" on public.subscription_coverage_grants;
create policy "subscription_coverage_grants_member_all"
  on public.subscription_coverage_grants
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

drop policy if exists "subscription_coverage_grants_customer_read" on public.subscription_coverage_grants;
create policy "subscription_coverage_grants_customer_read"
  on public.subscription_coverage_grants
  for select
  using (
    exists (
      select 1
      from public.customer_subscriptions cs
      join public.customers c on c.id = cs.customer_id
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where cs.id = subscription_coverage_grants.customer_subscription_id
        and ci.auth_user_id = auth.uid()
    )
  );

drop policy if exists "subscription_coverage_makeups_member_all" on public.subscription_coverage_makeups;
create policy "subscription_coverage_makeups_member_all"
  on public.subscription_coverage_makeups
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

drop policy if exists "subscription_coverage_forfeits_member_all" on public.subscription_coverage_forfeits;
create policy "subscription_coverage_forfeits_member_all"
  on public.subscription_coverage_forfeits
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.subscription_coverage_grants to service_role;
grant select, insert, update, delete on table public.subscription_coverage_makeups to service_role;
grant select, insert, update, delete on table public.subscription_coverage_forfeits to service_role;
