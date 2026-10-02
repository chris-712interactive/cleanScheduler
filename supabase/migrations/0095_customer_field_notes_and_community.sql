-- Crew-visible customer notes, separate from office-only internal_notes.
-- Optional community name on a service location (gated neighborhood, not a mailing line).

alter table public.tenant_customer_profiles
  add column if not exists field_notes text;

comment on column public.tenant_customer_profiles.field_notes is
  'Customer notes shown to field employees on jobs. Office-only notes stay in internal_notes.';

alter table public.tenant_customer_properties
  add column if not exists community_name text;

comment on column public.tenant_customer_properties.community_name is
  'Optional gated-community or neighborhood name. Not part of the mailing address.';
