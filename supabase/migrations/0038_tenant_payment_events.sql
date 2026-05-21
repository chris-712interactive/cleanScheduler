-- Tenant-visible payment chain-of-custody events for reports and exports.

create table public.tenant_payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  payment_id uuid references public.tenant_invoice_payments (id) on delete set null,
  invoice_id uuid references public.tenant_invoices (id) on delete set null,
  bank_transaction_id uuid references public.bank_transactions (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index tenant_payment_events_tenant_created_idx
  on public.tenant_payment_events (tenant_id, created_at desc);

create index tenant_payment_events_payment_idx
  on public.tenant_payment_events (payment_id, created_at desc)
  where payment_id is not null;

alter table public.tenant_payment_events enable row level security;

create policy "tenant_payment_events_member_read"
  on public.tenant_payment_events
  for select
  to authenticated
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.tenant_payment_events to service_role;
