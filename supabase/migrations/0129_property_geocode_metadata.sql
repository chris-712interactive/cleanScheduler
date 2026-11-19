-- Apply by hand. Do not run this against a hosted Supabase project from CI or an agent.
-- Service locations gain geocode status, source, match quality, and timestamp.
-- Existing row policies on tenant_customer_properties stay in force. This file
-- does not add a table, a policy, or a grant.

alter table public.tenant_customer_properties
  add column if not exists geocode_status text,
  add column if not exists geocode_source text,
  add column if not exists geocode_accuracy text,
  add column if not exists geocoded_at timestamptz;

alter table public.tenant_customer_properties
  drop constraint if exists tenant_customer_properties_geocode_status;

alter table public.tenant_customer_properties
  add constraint tenant_customer_properties_geocode_status
  check (
    geocode_status is null
    or geocode_status in ('pending', 'ok', 'failed')
  );

alter table public.tenant_customer_properties
  drop constraint if exists tenant_customer_properties_geocode_source;

alter table public.tenant_customer_properties
  add constraint tenant_customer_properties_geocode_source
  check (
    geocode_source is null
    or geocode_source in ('census', 'geocodio')
  );

comment on column public.tenant_customer_properties.geocode_status is
  'pending while a lookup is in flight, ok when a point was stored, failed when the lookup finished without a point.';

comment on column public.tenant_customer_properties.geocode_source is
  'Which geocoder stored the point: census or geocodio. Null on older points and on failures.';

comment on column public.tenant_customer_properties.geocode_accuracy is
  'Match quality from the geocoder, such as interpolated:L or rooftop.';

comment on column public.tenant_customer_properties.geocoded_at is
  'When the last finished lookup for this address text was stored.';

-- Backfill reads pending and never-tried rows for one tenant. Finished rows stay out of the index.
create index if not exists tenant_customer_properties_geocode_backfill_idx
  on public.tenant_customer_properties (tenant_id, id)
  where latitude is null
    and longitude is null
    and address_line1 is not null
    and geocode_status is distinct from 'ok'
    and geocode_status is distinct from 'failed';

-- RLS is unchanged. tenant_customer_properties already has row level security
-- and the member read/write policies from 0011, revised in 0126
-- (tenant_customer_properties_member_read, tenant_customer_properties_member_write).
-- New columns are covered by those row policies. service_role already has
-- select, insert, update, and delete on the table. anon and authenticated
-- receive no new grant here.
