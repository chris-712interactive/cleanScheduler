-- =============================================================================
-- 0004_tenant_onboarding_profiles.sql
-- =============================================================================
-- Stores richer self-serve onboarding context for tenant + owner.

create table public.tenant_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  company_email text,
  company_phone text,
  company_website text,
  service_area text,
  team_size text,
  business_type text,
  referral_source text,
  owner_name text,
  owner_email text,
  owner_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenant_onboarding_profiles_set_updated_at
before update on public.tenant_onboarding_profiles
for each row execute procedure public.set_updated_at();

alter table public.tenant_onboarding_profiles enable row level security;

create policy "tenant_onboarding_profiles_member_read"
  on public.tenant_onboarding_profiles
  for select
  using (
    public.is_platform_admin()
    or public.has_tenant_membership(tenant_id)
  );

create policy "tenant_onboarding_profiles_admin_write"
  on public.tenant_onboarding_profiles
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on table public.tenant_onboarding_profiles to service_role;
