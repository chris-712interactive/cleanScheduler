-- Structured walkthrough answers used to price a quote after a consultation.

alter table public.tenant_scheduled_visits
  add column if not exists consultation_intake jsonb;

comment on column public.tenant_scheduled_visits.consultation_intake is
  'Residential or commercial consultation answers captured on the visit and used when quoting.';
