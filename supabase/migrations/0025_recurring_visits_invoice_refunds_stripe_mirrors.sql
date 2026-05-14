-- =============================================================================
-- 0025_recurring_visits_invoice_refunds_stripe_mirrors.sql
-- =============================================================================
-- Recurring visit rules (RRULE) + signed invoice payment adjustments (refunds),
-- customer subscription billing anchor column, and payment total trigger fix.

-- -----------------------------------------------------------------------------
-- Recurring appointment rules (RRULE materializer — see /api/cron/…)
-- -----------------------------------------------------------------------------

create table public.recurring_appointment_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  property_id uuid references public.tenant_customer_properties(id) on delete set null,
  title text not null default 'Recurring visit',
  rrule_definition text not null,
  anchor_starts_at timestamptz not null,
  visit_duration_minutes integer not null default 120
    constraint recurring_rules_duration_pos check (visit_duration_minutes > 0),
  horizon_days integer not null default 60
    constraint recurring_rules_horizon_range check (horizon_days >= 1 and horizon_days <= 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_appointment_rules_tenant_active_idx
  on public.recurring_appointment_rules (tenant_id, is_active);

create trigger recurring_appointment_rules_set_updated_at
before update on public.recurring_appointment_rules
for each row execute procedure public.set_updated_at();

create or replace function public.enforce_recurring_rule_property()
returns trigger
language plpgsql
as $$
begin
  if new.property_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.tenant_customer_properties p
    where p.id = new.property_id
      and p.tenant_id = new.tenant_id
      and p.customer_id = new.customer_id
  ) then
    raise exception 'recurring_appointment_rules: property must belong to the same tenant and customer';
  end if;
  return new;
end;
$$;

create trigger recurring_appointment_rules_property_enforced
before insert or update of property_id, customer_id, tenant_id on public.recurring_appointment_rules
for each row execute procedure public.enforce_recurring_rule_property();

create or replace function public.enforce_recurring_rule_customer_tenant()
returns trigger
language plpgsql
as $$
declare
  c_tid uuid;
begin
  select tenant_id into c_tid from public.customers where id = new.customer_id;
  if c_tid is null or c_tid <> new.tenant_id then
    raise exception 'recurring_appointment_rules: customer tenant mismatch';
  end if;
  return new;
end;
$$;

create trigger recurring_appointment_rules_customer_tenant
before insert or update of tenant_id, customer_id on public.recurring_appointment_rules
for each row execute procedure public.enforce_recurring_rule_customer_tenant();

alter table public.tenant_scheduled_visits
  add column recurring_rule_id uuid references public.recurring_appointment_rules(id) on delete set null;

create unique index tenant_scheduled_visits_recurring_rule_starts_uidx
  on public.tenant_scheduled_visits (recurring_rule_id, starts_at)
  where recurring_rule_id is not null;

-- -----------------------------------------------------------------------------
-- Invoice payments: allow negative amounts (Stripe refunds) + signed totals
-- -----------------------------------------------------------------------------

alter table public.tenant_invoice_payments
  drop constraint if exists tenant_invoice_payments_amount_cents_check;

alter table public.tenant_invoice_payments
  add constraint tenant_invoice_payments_amount_nonzero check (amount_cents <> 0);

create or replace function public.apply_tenant_invoice_payment()
returns trigger
language plpgsql
as $$
declare
  new_paid integer;
begin
  new_paid := greatest(
    0,
    least(
      (select amount_cents from public.tenant_invoices where id = new.invoice_id),
      (select amount_paid_cents from public.tenant_invoices where id = new.invoice_id) + new.amount_cents
    )
  );

  update public.tenant_invoices
  set
    amount_paid_cents = new_paid,
    status = case
      when new_paid >= amount_cents then 'paid'::public.tenant_invoice_status
      else 'open'::public.tenant_invoice_status
    end,
    updated_at = now()
  where id = new.invoice_id
    and status <> 'void'::public.tenant_invoice_status;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Customer subscriptions: Stripe billing anchor (synced from webhooks)
-- -----------------------------------------------------------------------------

alter table public.customer_subscriptions
  add column billing_cycle_anchor timestamptz;

-- -----------------------------------------------------------------------------
-- RLS: recurring rules
-- -----------------------------------------------------------------------------

alter table public.recurring_appointment_rules enable row level security;

create policy "recurring_appointment_rules_member_all"
  on public.recurring_appointment_rules
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.recurring_appointment_rules to service_role;

revoke all on table public.recurring_appointment_rules from anon;
