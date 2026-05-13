-- =============================================================================
-- 0016_quote_line_items.sql
-- =============================================================================
-- Multi-service quotes: each quote can list several priced services with
-- cadence (e.g. one-time deep clean + weekly recurring). See
-- docs/product/quotes-line-items.md for business rules.

create type public.quote_line_frequency as enum (
  'one_time',
  'weekly',
  'biweekly',
  'monthly',
  'custom'
);

create table public.tenant_quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.tenant_quotes(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sort_order int not null default 0,
  service_label text not null,
  frequency public.quote_line_frequency not null default 'one_time',
  frequency_detail text,
  amount_cents bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_quote_line_items_amount_non_negative check (amount_cents >= 0),
  constraint tenant_quote_line_items_service_label_nonempty check (length(trim(service_label)) > 0)
);

create index tenant_quote_line_items_quote_idx
  on public.tenant_quote_line_items (quote_id, sort_order);

create index tenant_quote_line_items_tenant_idx
  on public.tenant_quote_line_items (tenant_id);

create trigger tenant_quote_line_items_set_updated_at
before update on public.tenant_quote_line_items
for each row execute procedure public.set_updated_at();

create or replace function public.tenant_quote_line_items_fill_tenant()
returns trigger
language plpgsql
as $$
declare
  tid uuid;
begin
  select q.tenant_id
    into tid
  from public.tenant_quotes q
  where q.id = new.quote_id;

  if tid is null then
    raise exception 'tenant_quote_line_items: quote not found';
  end if;

  new.tenant_id := tid;
  return new;
end;
$$;

create trigger tenant_quote_line_items_fill_tenant
before insert on public.tenant_quote_line_items
for each row execute procedure public.tenant_quote_line_items_fill_tenant();

alter table public.tenant_quote_line_items enable row level security;

create policy "tenant_quote_line_items_member_read"
  on public.tenant_quote_line_items
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_quote_line_items_member_write"
  on public.tenant_quote_line_items
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

revoke all on table public.tenant_quote_line_items from anon;
revoke all on table public.tenant_quote_line_items from authenticated;
grant select, insert, update, delete on table public.tenant_quote_line_items to service_role;
