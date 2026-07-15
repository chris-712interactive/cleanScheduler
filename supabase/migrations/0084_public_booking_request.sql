-- =============================================================================
-- 0084_public_booking_request.sql
-- Lite public /book quote request form (Starter+), independent of marketing CMS.
-- =============================================================================

alter table public.tenant_operational_settings
  add column if not exists public_booking_request_enabled boolean not null default true;

comment on column public.tenant_operational_settings.public_booking_request_enabled is
  'When true (and publicBookingRequest entitlement), expose {slug}.{apex}/book quote request form.';
