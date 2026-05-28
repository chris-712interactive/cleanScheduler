-- =============================================================================
-- 0009_tenant_quotes.sql
-- =============================================================================
-- Per-tenant quotes / proposals (MVP). Scheduling integrations come later.

create type public.quote_status as enum (
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired'
);

create table public.tenant_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  status public.quote_status not null default 'draft',
  amount_cents bigint,
  currency text not null default 'USD',
  notes text,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_quotes_amount_non_negative check (
    amount_cents is null or amount_cents >= 0
  )
);

create index tenant_quotes_tenant_created_idx
  on public.tenant_quotes (tenant_id, created_at desc);

create trigger tenant_quotes_set_updated_at
before update on public.tenant_quotes
for each row execute procedure public.set_updated_at();

alter table public.tenant_quotes enable row level security;

create policy "tenant_quotes_admin_or_tenant_member_read"
  on public.tenant_quotes
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_quotes_admin_or_tenant_member_write"
  on public.tenant_quotes
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (
    public.is_platform_admin()
    or (
      public.has_tenant_membership(tenant_id)
      and (
        customer_id is null
        or exists (
          select 1
          from public.customers cu
          where cu.id = tenant_quotes.customer_id
            and cu.tenant_id = tenant_quotes.tenant_id
        )
      )
    )
  );

grant select, insert, update, delete on table public.tenant_quotes to service_role;
