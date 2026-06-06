-- =============================================================================
-- 0070_consultation_duration_minutes.sql
-- =============================================================================
-- Default length for consultation visits (used to auto-set end time).

alter table public.tenant_operational_settings
  add column if not exists consultation_duration_minutes integer not null default 60;

alter table public.tenant_operational_settings
  drop constraint if exists tenant_operational_settings_consultation_duration_minutes_check;

alter table public.tenant_operational_settings
  add constraint tenant_operational_settings_consultation_duration_minutes_check
  check (consultation_duration_minutes between 15 and 480);
