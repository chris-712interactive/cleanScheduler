-- Crew size belongs to the property. One owner can have several sites that
-- need different crews. The quote records the number used while pricing, and
-- saving the quote copies it onto the service location for the day planner.

alter table public.tenant_customer_properties
  add column if not exists required_crew_size integer not null default 1;

alter table public.tenant_customer_properties
  drop constraint if exists tenant_customer_properties_crew_size;

alter table public.tenant_customer_properties
  add constraint tenant_customer_properties_crew_size
  check (required_crew_size between 1 and 8);

comment on column public.tenant_customer_properties.required_crew_size is
  'How many cleaners a visit at this property needs. Set on the location, the consultation, or the quote.';

update public.tenant_customer_properties p
set required_crew_size = least(
  8,
  greatest(1, round((p.scheduling_override ->> 'requiredCrewSize')::numeric)::integer)
)
where (p.scheduling_override ->> 'requiredCrewSize') ~ '^[0-9]+(\.[0-9]+)?$';

update public.tenant_customer_properties p
set required_crew_size = c.required_crew_size
from public.tenant_customer_scheduling_preferences c
where c.tenant_id = p.tenant_id
  and c.customer_id = p.customer_id
  and c.required_crew_size between 2 and 8
  and (
    p.scheduling_override is null
    or (p.scheduling_override ->> 'requiredCrewSize') is null
  );

comment on column public.tenant_customer_scheduling_preferences.required_crew_size is
  'No longer read by the day planner. Crew size lives on tenant_customer_properties.required_crew_size.';

alter table public.tenant_quotes
  add column if not exists required_crew_size integer not null default 1;

alter table public.tenant_quotes
  drop constraint if exists tenant_quotes_crew_size;

alter table public.tenant_quotes
  add constraint tenant_quotes_crew_size
  check (required_crew_size between 1 and 8);

comment on column public.tenant_quotes.required_crew_size is
  'Crew size priced on this quote. Saving the quote copies it onto the service location.';

-- Copy the property crew size onto existing quotes, including expired rows.
-- The expired-immutability trigger blocks any UPDATE on those quotes.
alter table public.tenant_quotes disable trigger tenant_quotes_07_reject_mutations_when_expired;

update public.tenant_quotes q
set required_crew_size = p.required_crew_size
from public.tenant_customer_properties p
where q.property_id = p.id
  and q.tenant_id = p.tenant_id
  and q.required_crew_size is distinct from p.required_crew_size;

alter table public.tenant_quotes enable trigger tenant_quotes_07_reject_mutations_when_expired;
