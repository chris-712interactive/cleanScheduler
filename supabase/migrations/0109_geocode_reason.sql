-- Why a saved address has no map point. Null when the point was saved, or when
-- the address is blank. The office shows this next to the address.

alter table public.tenant_member_scheduling_profiles
  add column if not exists home_geocode_reason text;

alter table public.tenant_member_scheduling_profiles
  drop constraint if exists tenant_member_scheduling_profiles_home_geocode_reason;

alter table public.tenant_member_scheduling_profiles
  add constraint tenant_member_scheduling_profiles_home_geocode_reason
  check (
    home_geocode_reason is null
    or home_geocode_reason in (
      'outside_us',
      'incomplete',
      'no_match',
      'google_denied',
      'google_quota',
      'lookup_failed'
    )
  );

comment on column public.tenant_member_scheduling_profiles.home_geocode_reason is
  'Why the home address has no map point. Null when coordinates were saved.';

alter table public.tenant_customer_properties
  add column if not exists geocode_reason text;

alter table public.tenant_customer_properties
  drop constraint if exists tenant_customer_properties_geocode_reason;

alter table public.tenant_customer_properties
  add constraint tenant_customer_properties_geocode_reason
  check (
    geocode_reason is null
    or geocode_reason in (
      'outside_us',
      'incomplete',
      'no_match',
      'google_denied',
      'google_quota',
      'lookup_failed'
    )
  );

comment on column public.tenant_customer_properties.geocode_reason is
  'Why this service location has no map point. Null when coordinates were saved.';

alter table public.tenants
  add column if not exists geocode_reason text;

alter table public.tenants
  drop constraint if exists tenants_geocode_reason;

alter table public.tenants
  add constraint tenants_geocode_reason
  check (
    geocode_reason is null
    or geocode_reason in (
      'outside_us',
      'incomplete',
      'no_match',
      'google_denied',
      'google_quota',
      'lookup_failed'
    )
  );

comment on column public.tenants.geocode_reason is
  'Why the business address has no map point. Null when coordinates were saved.';
