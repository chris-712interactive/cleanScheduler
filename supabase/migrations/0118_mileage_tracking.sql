-- Mileage days for field employees and office staff who drive to jobs or events.
-- Reimbursement and odometer readings are tenant switches. Both default off.

alter table public.tenant_operational_settings
  add column if not exists mileage_reimbursement_enabled boolean not null default false,
  add column if not exists mileage_rate_cents_per_mile integer,
  add column if not exists mileage_ask_odometer boolean not null default false,
  add column if not exists mileage_count_commute_to_first boolean not null default false,
  add column if not exists mileage_count_return_home boolean not null default false,
  add column if not exists mileage_count_between_stops boolean not null default true,
  add column if not exists mileage_count_office_legs boolean not null default true;

alter table public.tenant_operational_settings
  drop constraint if exists tenant_operational_settings_mileage_rate_nonneg;

alter table public.tenant_operational_settings
  add constraint tenant_operational_settings_mileage_rate_nonneg
  check (mileage_rate_cents_per_mile is null or mileage_rate_cents_per_mile >= 0);

comment on column public.tenant_operational_settings.mileage_reimbursement_enabled is
  'When false, mileage is a log only. When true, personal-car days get a dollar amount.';

create type public.mileage_day_status as enum ('draft', 'confirmed', 'approved');
create type public.mileage_vehicle as enum ('personal', 'company');
create type public.mileage_place_kind as enum (
  'home',
  'visit',
  'event',
  'supply',
  'estimate',
  'office',
  'other'
);
create type public.mileage_leg_source as enum ('saved', 'suggested', 'typed');

create table public.tenant_mileage_places (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  kind public.mileage_place_kind not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_mileage_places_tenant_idx
  on public.tenant_mileage_places (tenant_id, name);

create table public.tenant_mileage_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  work_date date not null,
  status public.mileage_day_status not null default 'draft',
  vehicle public.mileage_vehicle not null default 'personal',
  odometer_start numeric(10, 1),
  odometer_end numeric(10, 1),
  counted_miles numeric(8, 1) not null default 0,
  reimbursement_cents integer,
  note text,
  confirmed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_mileage_days_odometer_order check (
    odometer_start is null
    or odometer_end is null
    or odometer_end >= odometer_start
  ),
  constraint tenant_mileage_days_user_date unique (tenant_id, user_id, work_date)
);

create index tenant_mileage_days_tenant_date_idx
  on public.tenant_mileage_days (tenant_id, work_date desc);

create table public.tenant_mileage_legs (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.tenant_mileage_days (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sequence integer not null,
  origin_label text not null,
  origin_kind public.mileage_place_kind not null,
  origin_lat double precision,
  origin_lng double precision,
  dest_label text not null,
  dest_kind public.mileage_place_kind not null,
  dest_lat double precision,
  dest_lng double precision,
  visit_id uuid references public.tenant_scheduled_visits (id) on delete set null,
  included boolean not null default true,
  miles numeric(8, 1),
  source public.mileage_leg_source not null default 'typed',
  check_in_away boolean not null default false,
  created_at timestamptz not null default now(),
  constraint tenant_mileage_legs_sequence unique (day_id, sequence)
);

create index tenant_mileage_legs_visit_idx
  on public.tenant_mileage_legs (visit_id)
  where visit_id is not null;

create table public.tenant_mileage_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  origin_key text not null,
  dest_key text not null,
  miles numeric(8, 1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_mileage_segments_pair unique (tenant_id, origin_key, dest_key)
);

drop trigger if exists tenant_mileage_places_set_updated_at on public.tenant_mileage_places;
create trigger tenant_mileage_places_set_updated_at
before update on public.tenant_mileage_places
for each row execute procedure public.set_updated_at();

drop trigger if exists tenant_mileage_days_set_updated_at on public.tenant_mileage_days;
create trigger tenant_mileage_days_set_updated_at
before update on public.tenant_mileage_days
for each row execute procedure public.set_updated_at();

drop trigger if exists tenant_mileage_segments_set_updated_at on public.tenant_mileage_segments;
create trigger tenant_mileage_segments_set_updated_at
before update on public.tenant_mileage_segments
for each row execute procedure public.set_updated_at();

alter table public.tenant_mileage_places enable row level security;
alter table public.tenant_mileage_days enable row level security;
alter table public.tenant_mileage_legs enable row level security;
alter table public.tenant_mileage_segments enable row level security;

revoke all on table public.tenant_mileage_places from anon, authenticated;
revoke all on table public.tenant_mileage_days from anon, authenticated;
revoke all on table public.tenant_mileage_legs from anon, authenticated;
revoke all on table public.tenant_mileage_segments from anon, authenticated;

grant select, insert, update, delete on table public.tenant_mileage_places to service_role;
grant select, insert, update, delete on table public.tenant_mileage_days to service_role;
grant select, insert, update, delete on table public.tenant_mileage_legs to service_role;
grant select, insert, update, delete on table public.tenant_mileage_segments to service_role;

insert into public.tenant_role_permissions (role_id, permission_key)
select tr.id, p.key
from public.tenant_roles tr
cross join (
  values
    ('mileage.log'),
    ('mileage.review'),
    ('mileage.manage_settings')
) as p(key)
where tr.is_system = true
  and tr.slug in ('owner', 'admin')
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_key)
select tr.id, 'mileage.log'
from public.tenant_roles tr
where tr.is_system = true
  and tr.slug = 'employee'
on conflict do nothing;

create or replace function public.seed_tenant_system_roles_for_tenant()
returns trigger
language plpgsql
as $$
declare
  role_rec record;
  role_id uuid;
begin
  for role_rec in
    select *
    from (
      values
        ('Owner', 'owner', 'Full workspace control including billing and team management.', 'owner'::public.tenant_role),
        ('Admin', 'admin', 'Day-to-day workspace administration without ownership transfer.', 'admin'::public.tenant_role),
        ('Field employee', 'employee', 'Mobile-first access for crew — assigned jobs and proof photos.', 'employee'::public.tenant_role),
        ('Viewer', 'viewer', 'Read-only access for stakeholders who need visibility without changes.', 'viewer'::public.tenant_role)
    ) as defs(name, slug, description, base_role)
  loop
    insert into public.tenant_roles (tenant_id, name, slug, description, base_role, is_system)
    values (new.id, role_rec.name, role_rec.slug, role_rec.description, role_rec.base_role, true)
    returning id into role_id;

    if role_rec.slug in ('owner', 'admin') then
      insert into public.tenant_role_permissions (role_id, permission_key)
      select role_id, p.key
      from (
        values
          ('quotes.view'),
          ('quotes.manage'),
          ('billing.view'),
          ('billing.manage'),
          ('team.view'),
          ('team.invite'),
          ('team.manage_roles'),
          ('team.manage_members'),
          ('settings.view'),
          ('settings.operations'),
          ('settings.business'),
          ('messages.view'),
          ('messages.reply'),
          ('schedule.view'),
          ('schedule.manage'),
          ('customers.view'),
          ('customers.manage'),
          ('reports.view'),
          ('reports.export'),
          ('campaigns.view'),
          ('campaigns.manage'),
          ('hiring.view'),
          ('hiring.manage'),
          ('mileage.log'),
          ('mileage.review'),
          ('mileage.manage_settings')
      ) as p(key);
    elsif role_rec.slug = 'employee' then
      insert into public.tenant_role_permissions (role_id, permission_key)
      values
        (role_id, 'schedule.view'),
        (role_id, 'settings.view'),
        (role_id, 'mileage.log');
    elsif role_rec.slug = 'viewer' then
      insert into public.tenant_role_permissions (role_id, permission_key)
      values
        (role_id, 'quotes.view'),
        (role_id, 'customers.view'),
        (role_id, 'schedule.view'),
        (role_id, 'team.view'),
        (role_id, 'messages.view'),
        (role_id, 'settings.view');
    end if;
  end loop;

  return new;
end;
$$;
