-- =============================================================================
-- 0088_service_zones.sql
-- Tenant-managed CRM service zones (communities / areas) assigned on properties.
-- Separate from tenant_locations (Pro ops branches for visits/invoices).
-- =============================================================================

create table public.tenant_service_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_service_zones_sort_nonneg check (sort_order >= 0),
  constraint tenant_service_zones_name_nonempty check (length(trim(name)) > 0)
);

create unique index tenant_service_zones_tenant_name_unique_idx
  on public.tenant_service_zones (tenant_id, lower(name));

create index tenant_service_zones_tenant_active_sort_idx
  on public.tenant_service_zones (tenant_id, is_active, sort_order);

create trigger tenant_service_zones_set_updated_at
before update on public.tenant_service_zones
for each row execute procedure public.set_updated_at();

comment on table public.tenant_service_zones is
  'CRM service zones (communities / areas) for organizing customer properties. Available on all plans.';

alter table public.tenant_customer_properties
  add column if not exists service_zone_id uuid null
    references public.tenant_service_zones (id) on delete set null;

create index tenant_customer_properties_service_zone_idx
  on public.tenant_customer_properties (tenant_id, service_zone_id)
  where service_zone_id is not null;

comment on column public.tenant_customer_properties.service_zone_id is
  'Optional CRM service zone for this service location.';

alter table public.tenant_service_zones enable row level security;

create policy "tenant_service_zones_member_all"
  on public.tenant_service_zones
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.tenant_service_zones to service_role;
