-- =============================================================================
-- 0027_visit_checkin_completion.sql
-- Field check-in and completion timestamps for scheduled visits.
-- =============================================================================

alter table public.tenant_scheduled_visits
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null;

comment on column public.tenant_scheduled_visits.checked_in_at is
  'When a crew member checked in at the property.';
comment on column public.tenant_scheduled_visits.checked_in_by_user_id is
  'User who performed the property check-in.';
comment on column public.tenant_scheduled_visits.completed_at is
  'When the visit was marked completed in the field.';
comment on column public.tenant_scheduled_visits.completed_by_user_id is
  'User who marked the visit completed.';
