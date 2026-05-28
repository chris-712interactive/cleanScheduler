-- =============================================================================
-- 0010_tenant_customer_profiles.sql
-- =============================================================================
-- Rich tenant-scoped customer fields for quoting and scheduling workflows.

create table public.tenant_customer_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  company_name text,
  service_address_line1 text,
  service_address_line2 text,
  service_city text,
  service_state text,
  service_postal_code text,
  preferred_contact_method text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_customer_profiles_contact_method_check check (
    preferred_contact_method is null
    or preferred_contact_method in ('email', 'phone', 'sms')
  )
);

create index tenant_customer_profiles_tenant_customer_idx
  on public.tenant_customer_profiles (tenant_id, customer_id);

create trigger tenant_customer_profiles_set_updated_at
before update on public.tenant_customer_profiles
for each row execute procedure public.set_updated_at();

alter table public.tenant_customer_profiles enable row level security;

create policy "tenant_customer_profiles_member_read"
  on public.tenant_customer_profiles
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_customer_profiles_member_write"
  on public.tenant_customer_profiles
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (
    public.is_platform_admin()
    or (
      public.has_tenant_membership(tenant_id)
      and exists (
        select 1
        from public.customers c
        where c.id = tenant_customer_profiles.customer_id
          and c.tenant_id = tenant_customer_profiles.tenant_id
      )
    )
  );

grant select, insert, update, delete on table public.tenant_customer_profiles to service_role;
