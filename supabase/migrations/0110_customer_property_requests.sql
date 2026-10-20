-- A customer can ask to add a location from the portal. The timestamp marks that
-- request. A completed consultation visit for the same property finishes it.

alter table public.tenant_customer_properties
  add column if not exists consultation_requested_at timestamptz;

comment on column public.tenant_customer_properties.consultation_requested_at is
  'When the customer asked to add this location. Null for locations the office created.';

create index if not exists tenant_customer_properties_consultation_requested_idx
  on public.tenant_customer_properties (tenant_id, consultation_requested_at)
  where consultation_requested_at is not null;
