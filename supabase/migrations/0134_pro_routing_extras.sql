-- Pro routing extras: named start places, per-cleaner start/end, and the
-- drive figures saved when the office applies an order.
-- Apply this file by hand on each Supabase project after review.
-- Do not apply it to the shared dev project or to production from an agent.

create or replace function public.can_manage_route_office(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('owner'::public.tenant_role, 'admin'::public.tenant_role)
  );
$$;

comment on function public.can_manage_route_office(uuid) is
  'True when auth.uid() is an active owner or admin of the tenant. Security definer so route RLS can read memberships.';

revoke all on function public.can_manage_route_office(uuid) from public;
revoke all on function public.can_manage_route_office(uuid) from anon;
grant execute on function public.can_manage_route_office(uuid) to authenticated;
grant execute on function public.can_manage_route_office(uuid) to service_role;

create table public.tenant_route_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  label text not null,
  address_line1 text not null,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  geocode_status text,
  geocode_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_route_locations_label_len check (char_length(btrim(label)) between 1 and 80),
  constraint tenant_route_locations_line_len check (char_length(btrim(address_line1)) between 1 and 200),
  constraint tenant_route_locations_lat check (latitude is null or latitude between -90 and 90),
  constraint tenant_route_locations_lng check (longitude is null or longitude between -180 and 180),
  constraint tenant_route_locations_geocode_status check (
    geocode_status is null or geocode_status in ('pending', 'ok', 'failed')
  )
);

create unique index tenant_route_locations_label_idx
  on public.tenant_route_locations (tenant_id, lower(label));

create index tenant_route_locations_tenant_idx
  on public.tenant_route_locations (tenant_id, label);

comment on table public.tenant_route_locations is
  'Named start and end places for a workspace, such as a second office. Cleaner homes stay on the scheduling profile.';

create table public.tenant_cleaner_route_bases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  service_date date,
  start_kind text not null default 'office',
  start_location_id uuid references public.tenant_route_locations (id),
  end_kind text not null default 'none',
  end_location_id uuid references public.tenant_route_locations (id),
  updated_at timestamptz not null default now(),
  constraint tenant_cleaner_route_bases_start_kind check (start_kind in ('office', 'home', 'location')),
  constraint tenant_cleaner_route_bases_end_kind check (
    end_kind in ('none', 'same', 'office', 'home', 'location')
  ),
  constraint tenant_cleaner_route_bases_start_location check (
    (start_kind = 'location' and start_location_id is not null)
    or (start_kind <> 'location' and start_location_id is null)
  ),
  constraint tenant_cleaner_route_bases_end_location check (
    (end_kind = 'location' and end_location_id is not null)
    or (end_kind <> 'location' and end_location_id is null)
  )
);

create unique index tenant_cleaner_route_bases_default_idx
  on public.tenant_cleaner_route_bases (tenant_id, user_id)
  where service_date is null;

create unique index tenant_cleaner_route_bases_day_idx
  on public.tenant_cleaner_route_bases (tenant_id, user_id, service_date)
  where service_date is not null;

create index tenant_cleaner_route_bases_tenant_idx
  on public.tenant_cleaner_route_bases (tenant_id, service_date);

comment on table public.tenant_cleaner_route_bases is
  'Default or one-day start and end for a cleaner. service_date null is the default. Home addresses are not copied here.';

-- Deleting a place cannot leave start_kind or end_kind as location with a null id.
-- The row falls back to the office start and no return before the place is removed.
create or replace function public.release_route_location_bases()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenant_cleaner_route_bases
  set
    start_kind = 'office',
    start_location_id = null
  where tenant_id = old.tenant_id
    and start_location_id = old.id;

  update public.tenant_cleaner_route_bases
  set
    end_kind = 'none',
    end_location_id = null
  where tenant_id = old.tenant_id
    and end_location_id = old.id;

  return old;
end;
$$;

comment on function public.release_route_location_bases() is
  'Before a start place is deleted, bases that used it return to the office start and drop the return point.';

revoke all on function public.release_route_location_bases() from public;
revoke all on function public.release_route_location_bases() from anon;
grant execute on function public.release_route_location_bases() to authenticated;
grant execute on function public.release_route_location_bases() to service_role;

drop trigger if exists tenant_route_locations_release_bases on public.tenant_route_locations;
create trigger tenant_route_locations_release_bases
before delete on public.tenant_route_locations
for each row execute procedure public.release_route_location_bases();

create table public.tenant_applied_route_days (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  service_date date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  estimate_kind text not null,
  miles numeric(8, 1) not null,
  drive_seconds integer,
  stop_count integer not null,
  day_fingerprint text not null,
  applied_at timestamptz not null default now(),
  primary key (tenant_id, service_date, user_id),
  constraint tenant_applied_route_days_kind check (estimate_kind in ('straight-line', 'drive')),
  constraint tenant_applied_route_days_miles check (miles >= 0),
  constraint tenant_applied_route_days_stops check (stop_count >= 0),
  constraint tenant_applied_route_days_seconds check (drive_seconds is null or drive_seconds >= 0),
  constraint tenant_applied_route_days_label check (
    (estimate_kind = 'drive' and drive_seconds is not null)
    or (estimate_kind = 'straight-line' and drive_seconds is null)
  )
);

create index tenant_applied_route_days_tenant_date_idx
  on public.tenant_applied_route_days (tenant_id, service_date);

comment on table public.tenant_applied_route_days is
  'Drive minutes and miles saved when the office applies a stop order or dispatch. The report reads this table and does not call the routing engine.';

comment on column public.tenant_applied_route_days.estimate_kind is
  'drive is engine time and miles. straight-line is an estimate and is not driving miles.';

comment on column public.tenant_applied_route_days.day_fingerprint is
  'Hash of that day''s visits and approved time off after the apply. A different hash means the day changed.';

drop trigger if exists tenant_route_locations_set_updated_at on public.tenant_route_locations;
create trigger tenant_route_locations_set_updated_at
before update on public.tenant_route_locations
for each row execute procedure public.set_updated_at();

drop trigger if exists tenant_cleaner_route_bases_set_updated_at on public.tenant_cleaner_route_bases;
create trigger tenant_cleaner_route_bases_set_updated_at
before update on public.tenant_cleaner_route_bases
for each row execute procedure public.set_updated_at();

alter table public.tenant_route_locations enable row level security;
alter table public.tenant_cleaner_route_bases enable row level security;
alter table public.tenant_applied_route_days enable row level security;

revoke all on table public.tenant_route_locations from public;
revoke all on table public.tenant_route_locations from anon;
revoke all on table public.tenant_route_locations from authenticated;
grant select, insert, update, delete on table public.tenant_route_locations to authenticated;
grant select, insert, update, delete on table public.tenant_route_locations to service_role;

revoke all on table public.tenant_cleaner_route_bases from public;
revoke all on table public.tenant_cleaner_route_bases from anon;
revoke all on table public.tenant_cleaner_route_bases from authenticated;
grant select, insert, update, delete on table public.tenant_cleaner_route_bases to authenticated;
grant select, insert, update, delete on table public.tenant_cleaner_route_bases to service_role;

revoke all on table public.tenant_applied_route_days from public;
revoke all on table public.tenant_applied_route_days from anon;
revoke all on table public.tenant_applied_route_days from authenticated;
grant select on table public.tenant_applied_route_days to authenticated;
grant select, insert, update, delete on table public.tenant_applied_route_days to service_role;

create policy tenant_route_locations_office
  on public.tenant_route_locations
  for all
  to authenticated
  using (public.can_manage_route_office(tenant_id))
  with check (public.can_manage_route_office(tenant_id));

create policy tenant_cleaner_route_bases_office
  on public.tenant_cleaner_route_bases
  for all
  to authenticated
  using (public.can_manage_route_office(tenant_id))
  with check (public.can_manage_route_office(tenant_id));

create policy tenant_cleaner_route_bases_own_read
  on public.tenant_cleaner_route_bases
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_tenant_membership(tenant_id)
  );

create policy tenant_applied_route_days_office_read
  on public.tenant_applied_route_days
  for select
  to authenticated
  using (public.can_manage_route_office(tenant_id));

create policy tenant_applied_route_days_own_read
  on public.tenant_applied_route_days
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_tenant_membership(tenant_id)
  );
