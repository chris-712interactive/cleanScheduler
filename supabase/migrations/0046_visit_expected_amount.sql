-- Office-set job price on visits and recurring rules (field crews never enter pricing).

alter table public.tenant_scheduled_visits
  add column if not exists expected_amount_cents integer
    check (expected_amount_cents is null or expected_amount_cents >= 0);

comment on column public.tenant_scheduled_visits.expected_amount_cents is
  'Job price in cents set by office when scheduling. Used for field completion billing.';

alter table public.recurring_appointment_rules
  add column if not exists quote_id uuid references public.tenant_quotes(id) on delete set null;

alter table public.recurring_appointment_rules
  add column if not exists expected_amount_cents integer
    check (expected_amount_cents is null or expected_amount_cents >= 0);

comment on column public.recurring_appointment_rules.expected_amount_cents is
  'Per-visit job price copied to materialized visits when the rule runs.';

create index if not exists recurring_appointment_rules_quote_id_idx
  on public.recurring_appointment_rules (quote_id)
  where quote_id is not null;
