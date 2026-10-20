-- Minimum cleaners for a job type. The day planner uses the higher of this
-- number and the service location's crew size, so a deep clean can need two
-- people while a regular clean at the same house stays at one.

alter table public.tenant_service_templates
  add column if not exists default_crew_size integer not null default 1;

alter table public.tenant_service_templates
  drop constraint if exists tenant_service_templates_default_crew_size;

alter table public.tenant_service_templates
  add constraint tenant_service_templates_default_crew_size
  check (default_crew_size between 1 and 8);

comment on column public.tenant_service_templates.default_crew_size is
  'Minimum cleaners for a visit of this job type. The location crew size still applies when it is higher.';

update public.tenant_service_templates
set default_crew_size = 2
where kind = 'service_line'
  and default_crew_size = 1
  and lower(service_label) = 'deep cleaning';
