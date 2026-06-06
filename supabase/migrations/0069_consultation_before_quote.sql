-- =============================================================================
-- 0069_consultation_before_quote.sql
-- =============================================================================
-- Require completed consultation visits before quotes can be sent (tenant setting).
-- Distinct visit purpose for consultations vs service/cleaning visits.

create type public.scheduled_visit_purpose as enum ('service', 'consultation');

alter table public.tenant_operational_settings
  add column if not exists require_consultation_before_quote boolean not null default true;

alter table public.tenant_scheduled_visits
  add column if not exists visit_purpose public.scheduled_visit_purpose not null default 'service';

create index if not exists tenant_scheduled_visits_consultation_lookup_idx
  on public.tenant_scheduled_visits (tenant_id, customer_id, visit_purpose)
  where visit_purpose = 'consultation' and status <> 'cancelled';
