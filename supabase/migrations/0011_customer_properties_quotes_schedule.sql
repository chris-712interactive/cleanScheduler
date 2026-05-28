-- =============================================================================
-- 0011_customer_properties_quotes_schedule.sql
-- =============================================================================
-- Multi-property customers (commercial / short-term rental), quote site linkage,
-- and scheduled visits tied to customer + optional property.

-- -----------------------------------------------------------------------------
-- Property kind (Airbnb vs office vs home)
-- -----------------------------------------------------------------------------

create type public.customer_property_kind as enum (
  'residential',
  'commercial',
  'short_term_rental',
  'other'
);

-- -----------------------------------------------------------------------------
-- Service locations per tenant customer
-- -----------------------------------------------------------------------------

create table public.tenant_customer_properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  property_kind public.customer_property_kind not null default 'residential',
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  site_notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_customer_properties_tenant_idx
  on public.tenant_customer_properties (tenant_id);

create index tenant_customer_properties_customer_idx
  on public.tenant_customer_properties (customer_id);

create unique index tenant_customer_properties_one_primary_per_customer_idx
  on public.tenant_customer_properties (customer_id)
  where is_primary = true;

create trigger tenant_customer_properties_set_updated_at
before update on public.tenant_customer_properties
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Backfill: move profile addresses into a primary property; then drop address cols
-- -----------------------------------------------------------------------------

insert into public.tenant_customer_properties (
  tenant_id,
  customer_id,
  label,
  property_kind,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  site_notes,
  is_primary
)
select
  p.tenant_id,
  p.customer_id,
  'Primary service location',
  'residential'::public.customer_property_kind,
  p.service_address_line1,
  p.service_address_line2,
  p.service_city,
  p.service_state,
  p.service_postal_code,
  null,
  true
from public.tenant_customer_profiles p;

alter table public.tenant_customer_profiles
  drop column if exists service_address_line1,
  drop column if exists service_address_line2,
  drop column if exists service_city,
  drop column if exists service_state,
  drop column if exists service_postal_code;

-- -----------------------------------------------------------------------------
-- Quotes: optional service location
-- -----------------------------------------------------------------------------

alter table public.tenant_quotes
  add column property_id uuid references public.tenant_customer_properties(id) on delete set null;

create index tenant_quotes_property_id_idx on public.tenant_quotes (property_id);

create or replace function public.tenant_quotes_reset_property_on_customer_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.customer_id is null then
      new.property_id := null;
    end if;
    return new;
  end if;
  if new.customer_id is distinct from old.customer_id then
    if new.customer_id is null then
      new.property_id := null;
    elsif new.property_id is not null and not exists (
      select 1
      from public.tenant_customer_properties p
      where p.id = new.property_id
        and p.customer_id = new.customer_id
        and p.tenant_id = new.tenant_id
    ) then
      new.property_id := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger tenant_quotes_01_reset_property_on_customer_change
before insert or update of customer_id on public.tenant_quotes
for each row execute procedure public.tenant_quotes_reset_property_on_customer_change();

create or replace function public.enforce_tenant_quote_property()
returns trigger
language plpgsql
as $$
begin
  if new.property_id is null then
    return new;
  end if;
  if new.customer_id is null then
    raise exception 'tenant_quotes: property_id requires customer_id';
  end if;
  if not exists (
    select 1
    from public.tenant_customer_properties p
    where p.id = new.property_id
      and p.tenant_id = new.tenant_id
      and p.customer_id = new.customer_id
  ) then
    raise exception 'tenant_quotes: property must belong to the same tenant and customer';
  end if;
  return new;
end;
$$;

create trigger tenant_quotes_02_property_enforced
before insert or update of property_id, customer_id, tenant_id on public.tenant_quotes
for each row execute procedure public.enforce_tenant_quote_property();

-- -----------------------------------------------------------------------------
-- Scheduled visits (MVP)
-- -----------------------------------------------------------------------------

create type public.visit_status as enum (
  'scheduled',
  'completed',
  'cancelled'
);

create table public.tenant_scheduled_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  property_id uuid references public.tenant_customer_properties(id) on delete set null,
  quote_id uuid references public.tenant_quotes(id) on delete set null,
  title text not null default 'Visit',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.visit_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_scheduled_visits_time_window check (ends_at >= starts_at)
);

create index tenant_scheduled_visits_tenant_starts_idx
  on public.tenant_scheduled_visits (tenant_id, starts_at);

create index tenant_scheduled_visits_customer_idx
  on public.tenant_scheduled_visits (customer_id);

create trigger tenant_scheduled_visits_set_updated_at
before update on public.tenant_scheduled_visits
for each row execute procedure public.set_updated_at();

create or replace function public.enforce_scheduled_visit_property()
returns trigger
language plpgsql
as $$
begin
  if new.property_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.tenant_customer_properties p
    where p.id = new.property_id
      and p.tenant_id = new.tenant_id
      and p.customer_id = new.customer_id
  ) then
    raise exception 'tenant_scheduled_visits: property must belong to the same tenant and customer';
  end if;
  return new;
end;
$$;

create trigger tenant_scheduled_visits_property_enforced
before insert or update of property_id, customer_id, tenant_id on public.tenant_scheduled_visits
for each row execute procedure public.enforce_scheduled_visit_property();

-- -----------------------------------------------------------------------------
-- RLS: properties
-- -----------------------------------------------------------------------------

alter table public.tenant_customer_properties enable row level security;

create policy "tenant_customer_properties_member_read"
  on public.tenant_customer_properties
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_customer_properties_member_write"
  on public.tenant_customer_properties
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (
    public.is_platform_admin()
    or (
      public.has_tenant_membership(tenant_id)
      and exists (
        select 1
        from public.customers c
        where c.id = tenant_customer_properties.customer_id
          and c.tenant_id = tenant_customer_properties.tenant_id
      )
    )
  );

-- -----------------------------------------------------------------------------
-- RLS: scheduled visits
-- -----------------------------------------------------------------------------

alter table public.tenant_scheduled_visits enable row level security;

create policy "tenant_scheduled_visits_member_read"
  on public.tenant_scheduled_visits
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_scheduled_visits_member_write"
  on public.tenant_scheduled_visits
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (
    public.is_platform_admin()
    or (
      public.has_tenant_membership(tenant_id)
      and exists (
        select 1
        from public.customers c
        where c.id = tenant_scheduled_visits.customer_id
          and c.tenant_id = tenant_scheduled_visits.tenant_id
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Service role
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on table public.tenant_customer_properties to service_role;
grant select, insert, update, delete on table public.tenant_scheduled_visits to service_role;
