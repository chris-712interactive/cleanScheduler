-- =============================================================================
-- 0082_visit_gps_checkin.sql
-- Point-in-time GPS proof on visit check-in (not live fleet tracking).
-- =============================================================================

create type public.visit_check_in_location_status as enum (
  'captured',
  'denied',
  'unavailable',
  'unsupported'
);

alter table public.tenant_scheduled_visits
  add column if not exists check_in_lat double precision,
  add column if not exists check_in_lng double precision,
  add column if not exists check_in_accuracy_m double precision,
  add column if not exists check_in_location_status public.visit_check_in_location_status;

comment on column public.tenant_scheduled_visits.check_in_lat is
  'Device latitude at check-in (WGS84). Null when location was not captured.';
comment on column public.tenant_scheduled_visits.check_in_lng is
  'Device longitude at check-in (WGS84). Null when location was not captured.';
comment on column public.tenant_scheduled_visits.check_in_accuracy_m is
  'Geolocation accuracy radius in meters at check-in, when provided by the device.';
comment on column public.tenant_scheduled_visits.check_in_location_status is
  'Outcome of the check-in location request: captured, denied, unavailable, or unsupported.';

alter table public.tenant_scheduled_visits
  drop constraint if exists tenant_scheduled_visits_check_in_lat_range;
alter table public.tenant_scheduled_visits
  add constraint tenant_scheduled_visits_check_in_lat_range
  check (check_in_lat is null or (check_in_lat >= -90 and check_in_lat <= 90));

alter table public.tenant_scheduled_visits
  drop constraint if exists tenant_scheduled_visits_check_in_lng_range;
alter table public.tenant_scheduled_visits
  add constraint tenant_scheduled_visits_check_in_lng_range
  check (check_in_lng is null or (check_in_lng >= -180 and check_in_lng <= 180));

alter table public.tenant_scheduled_visits
  drop constraint if exists tenant_scheduled_visits_check_in_accuracy_nonneg;
alter table public.tenant_scheduled_visits
  add constraint tenant_scheduled_visits_check_in_accuracy_nonneg
  check (check_in_accuracy_m is null or check_in_accuracy_m >= 0);

alter table public.tenant_scheduled_visits
  drop constraint if exists tenant_scheduled_visits_check_in_location_coords;
alter table public.tenant_scheduled_visits
  add constraint tenant_scheduled_visits_check_in_location_coords
  check (
    (check_in_location_status is distinct from 'captured')
    or (check_in_lat is not null and check_in_lng is not null)
  );
