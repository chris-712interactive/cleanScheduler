-- Phase 2: Plaid bank link, transactions mirror, invoice match suggestions.

create type public.bank_link_status as enum ('active', 'login_required', 'disconnected');

create table public.bank_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plaid_item_id text not null unique,
  plaid_access_token text not null,
  plaid_institution_id text,
  institution_name text,
  plaid_account_id text not null,
  account_name text,
  account_mask text,
  account_type text,
  account_subtype text,
  transactions_cursor text,
  status public.bank_link_status not null default 'active',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create index bank_links_tenant_idx on public.bank_links (tenant_id);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  bank_link_id uuid not null references public.bank_links (id) on delete cascade,
  plaid_transaction_id text not null,
  amount_cents integer not null,
  posted_date date not null,
  authorized_date date,
  name text,
  merchant_name text,
  payment_channel text,
  pending boolean not null default false,
  iso_currency_code text not null default 'USD',
  matched_payment_id uuid references public.tenant_invoice_payments (id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (bank_link_id, plaid_transaction_id)
);

create index bank_transactions_tenant_posted_idx
  on public.bank_transactions (tenant_id, posted_date desc);

create index bank_transactions_unmatched_idx
  on public.bank_transactions (tenant_id, posted_date desc)
  where matched_payment_id is null and pending = false;

create table public.payment_match_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  bank_transaction_id uuid not null references public.bank_transactions (id) on delete cascade,
  invoice_id uuid not null references public.tenant_invoices (id) on delete cascade,
  confidence_score numeric(5, 4) not null,
  status text not null default 'suggested' check (status in ('suggested', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (bank_transaction_id, invoice_id)
);

create index payment_match_suggestions_tenant_status_idx
  on public.payment_match_suggestions (tenant_id, status);

alter table public.bank_links enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.payment_match_suggestions enable row level security;

create policy "bank_links_member_read"
  on public.bank_links
  for select
  to authenticated
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "bank_transactions_member_read"
  on public.bank_transactions
  for select
  to authenticated
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "payment_match_suggestions_member_read"
  on public.payment_match_suggestions
  for select
  to authenticated
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.bank_links to service_role;
grant select, insert, update, delete on table public.bank_transactions to service_role;
grant select, insert, update, delete on table public.payment_match_suggestions to service_role;
