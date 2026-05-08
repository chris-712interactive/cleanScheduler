-- =============================================================================
-- 0001_initial_auth_multitenant.sql
-- =============================================================================
-- Baseline schema for cleanScheduler multi-tenancy + auth-linked identities.
--
-- Scope in this migration:
--   - Core tenant + membership tables
--   - Core customer identity + tenant-link tables
--   - Initial role enums and helper functions for JWT-driven RLS
--   - RLS enablement + first-pass policies
--
-- NOTE: This migration intentionally avoids billing/scheduling/invoicing tables;
-- those land in follow-up migrations.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.app_role as enum (
  'super_admin',
  'admin',
  'employee',
  'customer'
);

create type public.tenant_role as enum (
  'owner',
  'admin',
  'employee',
  'viewer'
);

-- -----------------------------------------------------------------------------
-- Common updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Auth-linked user profile
-- -----------------------------------------------------------------------------

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_role public.app_role not null default 'customer',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tenants + memberships
-- -----------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'America/New_York',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$')
);

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute procedure public.set_updated_at();

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index tenant_memberships_user_id_idx on public.tenant_memberships (user_id);
create index tenant_memberships_tenant_id_idx on public.tenant_memberships (tenant_id);

create trigger tenant_memberships_set_updated_at
before update on public.tenant_memberships
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Global customer identity + per-tenant customer records
-- -----------------------------------------------------------------------------

create table public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_identities_auth_user_id_idx on public.customer_identities (auth_user_id);

create trigger customer_identities_set_updated_at
before update on public.customer_identities
for each row execute procedure public.set_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_identity_id uuid not null references public.customer_identities(id) on delete restrict,
  external_ref text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, customer_identity_id)
);

create index customers_tenant_id_idx on public.customers (tenant_id);
create index customers_identity_id_idx on public.customers (customer_identity_id);

create trigger customers_set_updated_at
before update on public.customers
for each row execute procedure public.set_updated_at();

create table public.customer_tenant_links (
  id uuid primary key default gen_random_uuid(),
  customer_identity_id uuid not null references public.customer_identities(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (customer_identity_id, tenant_id),
  unique (customer_identity_id, customer_id)
);

create index customer_tenant_links_customer_identity_id_idx
  on public.customer_tenant_links (customer_identity_id);
create index customer_tenant_links_tenant_id_idx
  on public.customer_tenant_links (tenant_id);

-- -----------------------------------------------------------------------------
-- RLS helper functions
-- -----------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'app_role')::public.app_role,
    'customer'::public.app_role
  );
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'current_tenant_id', '')::uuid;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('super_admin'::public.app_role, 'admin'::public.app_role);
$$;

create or replace function public.has_tenant_membership(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS policies
-- -----------------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.customer_identities enable row level security;
alter table public.customers enable row level security;
alter table public.customer_tenant_links enable row level security;

-- user_profiles
create policy "user_profiles_self_read"
  on public.user_profiles
  for select
  using (auth.uid() = user_id or public.is_platform_admin());

create policy "user_profiles_self_update"
  on public.user_profiles
  for update
  using (auth.uid() = user_id or public.is_platform_admin())
  with check (auth.uid() = user_id or public.is_platform_admin());

create policy "user_profiles_admin_insert"
  on public.user_profiles
  for insert
  with check (public.is_platform_admin());

-- tenants
create policy "tenants_admin_or_member_read"
  on public.tenants
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(id));

create policy "tenants_admin_write"
  on public.tenants
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- tenant_memberships
create policy "tenant_memberships_self_or_admin_read"
  on public.tenant_memberships
  for select
  using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or public.has_tenant_membership(tenant_id)
  );

create policy "tenant_memberships_admin_write"
  on public.tenant_memberships
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- customer_identities
create policy "customer_identities_admin_or_owner_read"
  on public.customer_identities
  for select
  using (
    public.is_platform_admin()
    or auth_user_id = auth.uid()
    or exists (
      select 1
      from public.customer_tenant_links ctl
      where ctl.customer_identity_id = customer_identities.id
        and public.has_tenant_membership(ctl.tenant_id)
    )
  );

create policy "customer_identities_admin_write"
  on public.customer_identities
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- customers
create policy "customers_admin_or_tenant_member_read"
  on public.customers
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "customers_admin_or_tenant_member_write"
  on public.customers
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

-- customer_tenant_links
create policy "customer_tenant_links_admin_or_tenant_member_read"
  on public.customer_tenant_links
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "customer_tenant_links_admin_or_tenant_member_write"
  on public.customer_tenant_links
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));
