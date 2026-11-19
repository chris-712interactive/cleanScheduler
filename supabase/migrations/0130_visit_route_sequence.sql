-- Office-applied stop order for one cleaner's day.
-- route_sequence is covered by the existing tenant member policies on
-- tenant_scheduled_visits. This migration does not add a policy and does not
-- grant the table to anon or authenticated.
-- Do not apply this file from CI. Apply it by hand after review.

alter table public.tenant_scheduled_visits
  add column if not exists route_sequence integer;

alter table public.tenant_scheduled_visits
  drop constraint if exists tenant_scheduled_visits_route_sequence_positive;

alter table public.tenant_scheduled_visits
  add constraint tenant_scheduled_visits_route_sequence_positive
  check (route_sequence is null or route_sequence >= 1);

comment on column public.tenant_scheduled_visits.route_sequence is
  '1-based stop order saved when the office applies a suggested route for one cleaner. Null until then. Straight-line order, not road miles. Existing member policies on this table cover the column.';

create index if not exists tenant_scheduled_visits_route_sequence_idx
  on public.tenant_scheduled_visits (tenant_id, route_sequence)
  where route_sequence is not null;
