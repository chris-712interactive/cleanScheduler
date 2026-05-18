-- Offline / manual payment audit trail (check, cash, Zelle, ACH, etc.)

alter table public.tenant_invoice_payments
  add column if not exists received_at timestamptz,
  add column if not exists received_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists deposited_at timestamptz,
  add column if not exists deposited_by_user_id uuid references auth.users(id) on delete set null;

comment on column public.tenant_invoice_payments.received_at is
  'When staff confirmed the offline payment was received (check, cash, Zelle, etc.).';
comment on column public.tenant_invoice_payments.deposited_at is
  'When staff confirmed the offline payment was deposited to the bank.';

create index if not exists tenant_invoice_payments_manual_audit_idx
  on public.tenant_invoice_payments (tenant_id, recorded_at desc)
  where recorded_via = 'manual'::public.tenant_invoice_payment_recorded_via;
