-- =============================================================================
-- 0028_customer_billing_visit_completion.sql
-- Per-customer preferred billing method and visit completion payment capture.
-- =============================================================================

alter table public.tenant_customer_profiles
  add column preferred_payment_method public.tenant_payment_method not null default 'card';

comment on column public.tenant_customer_profiles.preferred_payment_method is
  'How this customer usually pays (card/ACH → Stripe invoice; cash/check → collect on site).';

-- Link invoices to visits when created at job completion.
alter table public.tenant_invoices
  add column visit_id uuid references public.tenant_scheduled_visits(id) on delete set null;

create index tenant_invoices_visit_idx on public.tenant_invoices (visit_id)
  where visit_id is not null;

-- Completion payment capture (field crew).
alter table public.tenant_scheduled_visits
  add column completion_payment_collected boolean,
  add column completion_collected_method public.tenant_payment_method,
  add column completion_check_number text,
  add column completion_collected_amount_cents integer
    check (completion_collected_amount_cents is null or completion_collected_amount_cents >= 0),
  add column completion_invoice_id uuid references public.tenant_invoices(id) on delete set null;

comment on column public.tenant_scheduled_visits.completion_payment_collected is
  'Whether payment was collected when the job was marked complete.';
comment on column public.tenant_scheduled_visits.completion_collected_method is
  'cash or check when payment was collected on site.';
comment on column public.tenant_scheduled_visits.completion_check_number is
  'Check number when completion_collected_method is check.';
comment on column public.tenant_scheduled_visits.completion_collected_amount_cents is
  'Amount collected on site in cents.';
comment on column public.tenant_scheduled_visits.completion_invoice_id is
  'Invoice created or updated when the visit was completed.';
