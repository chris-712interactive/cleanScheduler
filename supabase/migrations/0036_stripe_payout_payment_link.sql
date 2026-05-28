-- Link invoice payments to Connect payout batches for reconciliation reports.

alter table public.tenant_invoice_payments
  add column stripe_payout_id text;

comment on column public.tenant_invoice_payments.stripe_payout_id is
  'Stripe payout id (po_*) on the connected account; set when payout.paid webhook backfills charges in the batch.';

create index tenant_invoice_payments_tenant_payout_idx
  on public.tenant_invoice_payments (tenant_id, stripe_payout_id)
  where stripe_payout_id is not null;
