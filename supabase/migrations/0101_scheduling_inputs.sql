-- Scheduling inputs the day planner can read: crew skills and limits,
-- customer and property preferences, and coordinates for straight-line drive time.

create table public.tenant_member_scheduling_profiles (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null,
  skill_tags text[] not null default '{}',
  certification_tags text[] not null default '{}',
  equipment_tags text[] not null default '{}',
  attribute_tags text[] not null default '{}',
  language_codes text[] not null default '{}',
  property_kinds text[] not null default '{}',
  handles_pets boolean not null default true,
  handles_chemical_sensitivity boolean not null default true,
  experience_level text not null default 'standard',
  max_jobs_per_day integer,
  max_minutes_per_day integer,
  max_drive_minutes integer,
  preferred_zone_ids uuid[] not null default '{}',
  preferred_partner_ids uuid[] not null default '{}',
  avoid_partner_ids uuid[] not null default '{}',
  home_address_line1 text,
  home_city text,
  home_state text,
  home_postal_code text,
  home_latitude double precision,
  home_longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint tenant_member_scheduling_profiles_user_fkey
    foreign key (user_id) references public.user_profiles (user_id) on delete cascade,
  constraint tenant_member_scheduling_profiles_experience check (
    experience_level in ('new', 'standard', 'lead')
  ),
  constraint tenant_member_scheduling_profiles_caps check (
    (max_jobs_per_day is null or max_jobs_per_day between 1 and 20)
    and (max_minutes_per_day is null or max_minutes_per_day between 30 and 960)
    and (max_drive_minutes is null or max_drive_minutes between 5 and 180)
  )
);

create trigger tenant_member_scheduling_profiles_set_updated_at
before update on public.tenant_member_scheduling_profiles
for each row execute procedure public.set_updated_at();

comment on table public.tenant_member_scheduling_profiles is
  'Skills, limits, home base, and pairing preferences used by the day planner.';

create table public.tenant_customer_scheduling_preferences (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  preferred_user_ids uuid[] not null default '{}',
  required_user_ids uuid[] not null default '{}',
  blocked_user_ids uuid[] not null default '{}',
  arrival_start time,
  arrival_end time,
  access_start time,
  access_end time,
  pet_in_home boolean not null default false,
  chemical_sensitivity boolean not null default false,
  language_codes text[] not null default '{}',
  required_attribute_tags text[] not null default '{}',
  priority integer not null default 3,
  required_crew_size integer not null default 1,
  required_skill_tags text[] not null default '{}',
  required_certification_tags text[] not null default '{}',
  required_equipment_tags text[] not null default '{}',
  requires_key_pickup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, customer_id),
  constraint tenant_customer_scheduling_preferences_priority check (priority between 1 and 5),
  constraint tenant_customer_scheduling_preferences_crew_size check (required_crew_size between 1 and 8),
  constraint tenant_customer_scheduling_preferences_arrival check (
    arrival_start is null or arrival_end is null or arrival_end > arrival_start
  ),
  constraint tenant_customer_scheduling_preferences_access check (
    access_start is null or access_end is null or access_end > access_start
  )
);

create trigger tenant_customer_scheduling_preferences_set_updated_at
before update on public.tenant_customer_scheduling_preferences
for each row execute procedure public.set_updated_at();

comment on table public.tenant_customer_scheduling_preferences is
  'Default scheduling preferences for every property on this customer. A property may override them.';

alter table public.tenant_customer_properties
  add column if not exists building_name text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists scheduling_override jsonb;

comment on column public.tenant_customer_properties.building_name is
  'Building or suite name used to batch stops. Separate from community name.';
comment on column public.tenant_customer_properties.scheduling_override is
  'When set, replaces the customer scheduling defaults for this property.';
comment on column public.tenant_customer_properties.latitude is
  'WGS84 latitude from address geocoding. Null until an address resolves.';

alter table public.tenants
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

comment on column public.tenants.latitude is
  'WGS84 latitude of the business address, used as the office for key pickup and first-stop routing.';

revoke all on table public.tenant_member_scheduling_profiles from anon, authenticated;
revoke all on table public.tenant_customer_scheduling_preferences from anon, authenticated;
grant select, insert, update, delete on table public.tenant_member_scheduling_profiles to service_role;
grant select, insert, update, delete on table public.tenant_customer_scheduling_preferences to service_role;
