-- Mirror Stripe Billing subscription invoices into tenant_invoices.

create type public.tenant_invoice_source as enum ('manual', 'checkout', 'stripe_billing');

alter table public.tenant_invoices
  add column if not exists source public.tenant_invoice_source not null default 'manual',
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists hosted_invoice_url text,
  add column if not exists invoice_pdf_url text,
  add column if not exists billing_period_start timestamptz,
  add column if not exists billing_period_end timestamptz,
  add column if not exists last_payment_error text;

create unique index if not exists tenant_invoices_stripe_invoice_uidx
  on public.tenant_invoices (tenant_id, stripe_invoice_id)
  where stripe_invoice_id is not null;

comment on column public.tenant_invoices.source is
  'manual = staff-created; checkout = one-off Stripe Checkout; stripe_billing = Connect subscription invoice mirror.';
