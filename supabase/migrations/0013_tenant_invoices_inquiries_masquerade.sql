-- =============================================================================
-- 0013_tenant_invoices_inquiries_masquerade.sql
-- =============================================================================
-- Tenant customer invoices + payments, marketing inquiries, masquerade +
-- audit trail, customer support threads (MVP), and RLS so the customer portal
-- can read its own rows via the anon/cookie client.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.tenant_invoice_status as enum ('draft', 'open', 'paid', 'void');

create type public.tenant_payment_method as enum (
  'cash',
  'check',
  'zelle',
  'card',
  'ach',
  'other'
);

create type public.marketing_inquiry_status as enum ('new', 'contacted', 'closed');

-- -----------------------------------------------------------------------------
-- Customer can read their own per-tenant customer row (customer portal)
-- -----------------------------------------------------------------------------

create policy "customers_linked_identity_read"
  on public.customers
  for select
  using (
    exists (
      select 1
      from public.customer_identities ci
      where ci.id = customers.customer_identity_id
        and ci.auth_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Tenant invoices
-- -----------------------------------------------------------------------------

create table public.tenant_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  title text not null default 'Invoice',
  status public.tenant_invoice_status not null default 'open',
  currency text not null default 'usd',
  amount_cents integer not null check (amount_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  due_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_invoices_amount_paid_cap check (amount_paid_cents <= amount_cents)
);

create index tenant_invoices_tenant_created_idx
  on public.tenant_invoices (tenant_id, created_at desc);

create index tenant_invoices_customer_idx on public.tenant_invoices (customer_id);

create trigger tenant_invoices_set_updated_at
before update on public.tenant_invoices
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Payments apply to invoice totals
-- -----------------------------------------------------------------------------

create table public.tenant_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.tenant_invoices(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method public.tenant_payment_method not null default 'other',
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index tenant_invoice_payments_invoice_idx
  on public.tenant_invoice_payments (invoice_id);

create or replace function public.enforce_tenant_invoice_payment_tenant()
returns trigger
language plpgsql
as $$
declare
  tid uuid;
  inv_status public.tenant_invoice_status;
begin
  select tenant_id, status into tid, inv_status from public.tenant_invoices where id = new.invoice_id;
  if tid is null then
    raise exception 'tenant_invoice_payments: invoice not found';
  end if;
  if tid <> new.tenant_id then
    raise exception 'tenant_invoice_payments: tenant_id must match invoice';
  end if;
  if inv_status = 'void'::public.tenant_invoice_status then
    raise exception 'tenant_invoice_payments: invoice is void';
  end if;
  return new;
end;
$$;

create trigger tenant_invoice_payments_enforce_tenant
before insert or update of tenant_id, invoice_id on public.tenant_invoice_payments
for each row execute procedure public.enforce_tenant_invoice_payment_tenant();

create or replace function public.apply_tenant_invoice_payment()
returns trigger
language plpgsql
as $$
begin
  update public.tenant_invoices
  set
    amount_paid_cents = least(
      amount_cents,
      amount_paid_cents + new.amount_cents
    ),
    status = case
      when least(amount_cents, amount_paid_cents + new.amount_cents) >= amount_cents
        then 'paid'::public.tenant_invoice_status
      else tenant_invoices.status
    end,
    updated_at = now()
  where id = new.invoice_id
    and status <> 'void'::public.tenant_invoice_status;

  return new;
end;
$$;

create trigger tenant_invoice_payments_apply_totals
after insert on public.tenant_invoice_payments
for each row execute procedure public.apply_tenant_invoice_payment();

-- -----------------------------------------------------------------------------
-- Marketing inquiries (insert via service role from server actions)
-- -----------------------------------------------------------------------------

create table public.marketing_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  message text not null,
  status public.marketing_inquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_inquiries_created_idx
  on public.marketing_inquiries (created_at desc);

create trigger marketing_inquiries_set_updated_at
before update on public.marketing_inquiries
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Masquerade + audit
-- -----------------------------------------------------------------------------

create table public.masquerade_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_tenant_id uuid not null references public.tenants(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index masquerade_sessions_admin_started_idx
  on public.masquerade_sessions (admin_user_id, started_at desc);

create table public.audit_log_entries (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_tenant_id uuid references public.tenants(id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entries_created_idx
  on public.audit_log_entries (created_at desc);

-- -----------------------------------------------------------------------------
-- Customer ↔ tenant messaging (MVP)
-- -----------------------------------------------------------------------------

create table public.customer_support_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  subject text not null default 'Message',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_support_threads_tenant_idx
  on public.customer_support_threads (tenant_id, created_at desc);

create trigger customer_support_threads_set_updated_at
before update on public.customer_support_threads
for each row execute procedure public.set_updated_at();

create table public.customer_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.customer_support_threads(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  is_from_customer boolean not null default true,
  created_at timestamptz not null default now()
);

create index customer_support_messages_thread_idx
  on public.customer_support_messages (thread_id, created_at);

-- -----------------------------------------------------------------------------
-- RLS: invoices + payments
-- -----------------------------------------------------------------------------

alter table public.tenant_invoices enable row level security;

create policy "tenant_invoices_member_read"
  on public.tenant_invoices
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_invoices_member_write"
  on public.tenant_invoices
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_invoices_customer_read"
  on public.tenant_invoices
  for select
  using (
    exists (
      select 1
      from public.customers c
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where c.id = tenant_invoices.customer_id
        and ci.auth_user_id = auth.uid()
    )
  );

alter table public.tenant_invoice_payments enable row level security;

create policy "tenant_invoice_payments_member_read"
  on public.tenant_invoice_payments
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_invoice_payments_member_write"
  on public.tenant_invoice_payments
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_invoice_payments_customer_read"
  on public.tenant_invoice_payments
  for select
  using (
    exists (
      select 1
      from public.tenant_invoices inv
      join public.customers c on c.id = inv.customer_id
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where inv.id = tenant_invoice_payments.invoice_id
        and ci.auth_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- RLS: marketing inquiries (platform admins only)
-- -----------------------------------------------------------------------------

alter table public.marketing_inquiries enable row level security;

create policy "marketing_inquiries_platform_read"
  on public.marketing_inquiries
  for select
  using (public.is_platform_admin());

create policy "marketing_inquiries_platform_write"
  on public.marketing_inquiries
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- RLS: masquerade + audit
-- -----------------------------------------------------------------------------

alter table public.masquerade_sessions enable row level security;

create policy "masquerade_sessions_platform_read"
  on public.masquerade_sessions
  for select
  using (public.is_platform_admin());

create policy "masquerade_sessions_platform_write"
  on public.masquerade_sessions
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.audit_log_entries enable row level security;

create policy "audit_log_entries_platform_read"
  on public.audit_log_entries
  for select
  using (public.is_platform_admin());

create policy "audit_log_entries_platform_write"
  on public.audit_log_entries
  for insert
  with check (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- RLS: support threads + messages
-- -----------------------------------------------------------------------------

alter table public.customer_support_threads enable row level security;

create policy "customer_support_threads_member_all"
  on public.customer_support_threads
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "customer_support_threads_customer_rw"
  on public.customer_support_threads
  for select
  using (
    exists (
      select 1
      from public.customers c
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where c.id = customer_support_threads.customer_id
        and ci.auth_user_id = auth.uid()
    )
  );

create policy "customer_support_threads_customer_insert"
  on public.customer_support_threads
  for insert
  with check (
    exists (
      select 1
      from public.customers c
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where c.id = customer_support_threads.customer_id
        and ci.auth_user_id = auth.uid()
    )
  );

alter table public.customer_support_messages enable row level security;

create policy "customer_support_messages_member_all"
  on public.customer_support_messages
  for all
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.customer_support_threads t
      where t.id = customer_support_messages.thread_id
        and public.has_tenant_membership(t.tenant_id)
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1
      from public.customer_support_threads t
      where t.id = customer_support_messages.thread_id
        and public.has_tenant_membership(t.tenant_id)
    )
  );

create policy "customer_support_messages_customer_rw"
  on public.customer_support_messages
  for select
  using (
    exists (
      select 1
      from public.customer_support_threads t
      join public.customers c on c.id = t.customer_id
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where t.id = customer_support_messages.thread_id
        and ci.auth_user_id = auth.uid()
    )
  );

create policy "customer_support_messages_customer_insert"
  on public.customer_support_messages
  for insert
  with check (
    exists (
      select 1
      from public.customer_support_threads t
      join public.customers c on c.id = t.customer_id
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where t.id = customer_support_messages.thread_id
        and ci.auth_user_id = auth.uid()
    )
    and is_from_customer = true
  );

-- -----------------------------------------------------------------------------
-- Service role
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on table public.tenant_invoices to service_role;
grant select, insert, update, delete on table public.tenant_invoice_payments to service_role;
grant select, insert, update, delete on table public.marketing_inquiries to service_role;
grant select, insert, update, delete on table public.masquerade_sessions to service_role;
grant select, insert, update, delete on table public.audit_log_entries to service_role;
grant select, insert, update, delete on table public.customer_support_threads to service_role;
grant select, insert, update, delete on table public.customer_support_messages to service_role;

-- -----------------------------------------------------------------------------
-- Customers can read tenant names for providers they are linked to
-- -----------------------------------------------------------------------------

create policy "tenants_customer_linked_read"
  on public.tenants
  for select
  using (
    exists (
      select 1
      from public.customers c
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where c.tenant_id = tenants.id
        and ci.auth_user_id = auth.uid()
    )
  );
