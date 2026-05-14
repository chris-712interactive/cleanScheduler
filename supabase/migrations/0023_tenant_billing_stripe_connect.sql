-- =============================================================================
-- 0023_tenant_billing_stripe_connect.sql
-- =============================================================================
-- Stripe Connect Express onboarding state, invoice payment Stripe metadata,
-- usage snapshot placeholder, check-hold setting, and mirror tables for
-- Connect webhooks (refunds / disputes / payouts). See implementation plan §15–17.

-- -----------------------------------------------------------------------------
-- Tenant Connect onboarding (Express)
-- -----------------------------------------------------------------------------

create type public.tenant_stripe_connect_status as enum (
  'not_started',
  'pending',
  'complete',
  'restricted'
);

alter table public.tenants
  add column stripe_connect_status public.tenant_stripe_connect_status not null default 'not_started';

comment on column public.tenants.stripe_connect_status is
  'Cached from tenant_stripe_connect_accounts for fast gating; updated by trigger + webhooks.';

create table public.tenant_stripe_connect_accounts (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements_disabled_reason text,
  requirements_currently_due jsonb,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_stripe_connect_accounts_stripe_idx
  on public.tenant_stripe_connect_accounts (stripe_account_id);

create trigger tenant_stripe_connect_accounts_set_updated_at
before update on public.tenant_stripe_connect_accounts
for each row execute procedure public.set_updated_at();

create or replace function public.sync_tenant_stripe_connect_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  st public.tenant_stripe_connect_status;
begin
  if tg_op = 'DELETE' then
    tid := old.tenant_id;
    update public.tenants
    set stripe_connect_status = 'not_started'::public.tenant_stripe_connect_status,
        updated_at = now()
    where id = tid;
    return old;
  end if;

  tid := new.tenant_id;

  if new.charges_enabled and new.payouts_enabled then
    st := 'complete'::public.tenant_stripe_connect_status;
  elsif new.requirements_disabled_reason is not null
    and btrim(new.requirements_disabled_reason) <> '' then
    st := 'restricted'::public.tenant_stripe_connect_status;
  elsif new.stripe_account_id is not null then
    st := 'pending'::public.tenant_stripe_connect_status;
  else
    st := 'not_started'::public.tenant_stripe_connect_status;
  end if;

  update public.tenants
  set stripe_connect_status = st,
      updated_at = now()
  where id = tid;

  return new;
end;
$$;

create trigger tenant_stripe_connect_accounts_sync_status_ins
after insert on public.tenant_stripe_connect_accounts
for each row execute procedure public.sync_tenant_stripe_connect_status();

create trigger tenant_stripe_connect_accounts_sync_status_upd
after update on public.tenant_stripe_connect_accounts
for each row execute procedure public.sync_tenant_stripe_connect_status();

create trigger tenant_stripe_connect_accounts_sync_status_del
after delete on public.tenant_stripe_connect_accounts
for each row execute procedure public.sync_tenant_stripe_connect_status();

-- -----------------------------------------------------------------------------
-- Operational: check reminder hold (invoice reminder cron — future)
-- -----------------------------------------------------------------------------

alter table public.tenant_operational_settings
  add column check_reminder_hold_days integer not null default 7
    constraint tenant_op_settings_check_hold_days_range check (
      check_reminder_hold_days >= 0
      and check_reminder_hold_days <= 120
    );

comment on column public.tenant_operational_settings.check_reminder_hold_days is
  'Skip automated invoice reminders while a field-collected check is within this many days of receipt (see plan Concern #2).';

-- -----------------------------------------------------------------------------
-- Invoice payments: Stripe + fee columns (§17 accounting mirror)
-- -----------------------------------------------------------------------------

create type public.tenant_invoice_payment_recorded_via as enum ('manual', 'stripe_checkout');

alter table public.tenant_invoice_payments
  add column recorded_via public.tenant_invoice_payment_recorded_via not null default 'manual',
  add column stripe_checkout_session_id text unique,
  add column stripe_payment_intent_id text,
  add column stripe_charge_id text,
  add column stripe_balance_transaction_id text,
  add column gross_amount_cents integer,
  add column stripe_fee_cents integer,
  add column application_fee_cents integer,
  add column net_amount_cents integer;

comment on column public.tenant_invoice_payments.recorded_via is
  'manual = staff entry; stripe_checkout = customer paid via Connect Checkout.';

-- -----------------------------------------------------------------------------
-- Usage snapshots (nightly rollup cron — table only for now)
-- -----------------------------------------------------------------------------

create table public.tenant_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  snapshot_date date not null,
  active_user_count integer not null default 0,
  active_customer_count integer not null default 0,
  sms_segments_used integer not null default 0,
  email_sends integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, snapshot_date)
);

create index tenant_usage_snapshots_tenant_date_idx
  on public.tenant_usage_snapshots (tenant_id, snapshot_date desc);

-- -----------------------------------------------------------------------------
-- Connect-side mirror tables (webhooks populate; reporting later)
-- -----------------------------------------------------------------------------

create table public.tenant_stripe_refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_refund_id text not null unique,
  stripe_charge_id text,
  amount_cents integer not null,
  status text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index tenant_stripe_refunds_tenant_idx on public.tenant_stripe_refunds (tenant_id);

create table public.tenant_stripe_disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  amount_cents integer not null,
  status text not null,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index tenant_stripe_disputes_tenant_idx on public.tenant_stripe_disputes (tenant_id);

create table public.tenant_stripe_payouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_payout_id text not null unique,
  amount_cents integer not null,
  status text,
  arrival_date date,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index tenant_stripe_payouts_tenant_idx on public.tenant_stripe_payouts (tenant_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.tenant_stripe_connect_accounts enable row level security;

create policy "tenant_stripe_connect_accounts_member_read"
  on public.tenant_stripe_connect_accounts
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

alter table public.tenant_usage_snapshots enable row level security;

create policy "tenant_usage_snapshots_member_read"
  on public.tenant_usage_snapshots
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

alter table public.tenant_stripe_refunds enable row level security;

create policy "tenant_stripe_refunds_member_read"
  on public.tenant_stripe_refunds
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

alter table public.tenant_stripe_disputes enable row level security;

create policy "tenant_stripe_disputes_member_read"
  on public.tenant_stripe_disputes
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

alter table public.tenant_stripe_payouts enable row level security;

create policy "tenant_stripe_payouts_member_read"
  on public.tenant_stripe_payouts
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

revoke all on table public.tenant_stripe_connect_accounts from anon;
revoke all on table public.tenant_stripe_connect_accounts from authenticated;
grant select, insert, update, delete on table public.tenant_stripe_connect_accounts to service_role;

revoke all on table public.tenant_usage_snapshots from anon;
revoke all on table public.tenant_usage_snapshots from authenticated;
grant select, insert, update, delete on table public.tenant_usage_snapshots to service_role;

revoke all on table public.tenant_stripe_refunds from anon;
revoke all on table public.tenant_stripe_refunds from authenticated;
grant select, insert, update, delete on table public.tenant_stripe_refunds to service_role;

revoke all on table public.tenant_stripe_disputes from anon;
revoke all on table public.tenant_stripe_disputes from authenticated;
grant select, insert, update, delete on table public.tenant_stripe_disputes to service_role;

revoke all on table public.tenant_stripe_payouts from anon;
revoke all on table public.tenant_stripe_payouts from authenticated;
grant select, insert, update, delete on table public.tenant_stripe_payouts to service_role;
