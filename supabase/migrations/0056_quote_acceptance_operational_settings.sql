-- Release 1.1.0: wire tenant operational settings into quote acceptance follow-up.

alter table public.tenant_invoices
  add column if not exists quote_id uuid references public.tenant_quotes(id) on delete set null;

create unique index if not exists tenant_invoices_tenant_quote_uidx
  on public.tenant_invoices (tenant_id, quote_id)
  where quote_id is not null;

comment on column public.tenant_invoices.quote_id is
  'When set, invoice was created from quote acceptance (e.g. prepay) or linked billing.';

alter table public.tenant_quote_acceptance_e_signatures
  add column if not exists preferred_payment_method public.tenant_payment_method;

comment on column public.tenant_quote_acceptance_e_signatures.preferred_payment_method is
  'Customer-selected payment method at acceptance; must be in tenant allowed_customer_payment_methods.';
