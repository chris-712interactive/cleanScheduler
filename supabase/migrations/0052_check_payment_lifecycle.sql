-- Extend manual payment audit lifecycle for checks and Zelle metadata.

alter table public.tenant_invoice_payments
  add column if not exists check_number text,
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by_user_id uuid references auth.users (id) on delete set null,
  add column if not exists bounced_at timestamptz,
  add column if not exists bounce_reason text,
  add column if not exists zelle_confirmation text;

create index if not exists tenant_invoice_payments_check_number_idx
  on public.tenant_invoice_payments (tenant_id, check_number)
  where check_number is not null;

alter table public.tenant_operational_settings
  add column if not exists check_hold_through_deposit boolean not null default false;

comment on column public.tenant_operational_settings.check_hold_through_deposit is
  'When true, overdue invoice reminders stay paused until check payments are deposited (not just received).';
