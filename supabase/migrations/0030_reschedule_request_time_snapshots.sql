-- Snapshot visit times at request creation and when a reschedule is approved.

alter table public.visit_reschedule_requests
  add column if not exists original_starts_at timestamptz,
  add column if not exists original_ends_at timestamptz,
  add column if not exists applied_starts_at timestamptz,
  add column if not exists applied_ends_at timestamptz;

comment on column public.visit_reschedule_requests.original_starts_at is
  'Visit start time when the customer submitted the request.';
comment on column public.visit_reschedule_requests.applied_starts_at is
  'Visit start time after tenant approval (if completed).';

-- Best-effort backfill for completed requests: applied = preferred window.
update public.visit_reschedule_requests r
set
  applied_starts_at = coalesce(r.applied_starts_at, r.preferred_starts_at),
  applied_ends_at = coalesce(r.applied_ends_at, r.preferred_ends_at)
where r.status = 'completed'
  and r.preferred_starts_at is not null;
