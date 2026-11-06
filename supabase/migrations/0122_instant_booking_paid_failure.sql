-- =============================================================================
-- 0122_instant_booking_paid_failure.sql
-- Remember why a paid booking was refunded so the customer and the office
-- see the real reason.
-- =============================================================================

alter table public.tenant_instant_bookings
  add column if not exists resolution_code text,
  add column if not exists deposit_refunded boolean not null default false;

alter table public.tenant_instant_bookings
  drop constraint if exists tenant_instant_bookings_resolution_code_check;

alter table public.tenant_instant_bookings
  add constraint tenant_instant_bookings_resolution_code_check
    check (
      resolution_code is null
      or resolution_code in ('slot_taken', 'capacity', 'amount_mismatch', 'generic')
    );

comment on column public.tenant_instant_bookings.resolution_code is
  'Why a paid instant booking did not become a visit: slot_taken, capacity, amount_mismatch, or generic.';
