-- =============================================================================
-- 0063_recurring_occurrence_skips.sql
-- Skip materializing RRULE occurrences that were rescheduled or deleted.
-- =============================================================================

create table public.recurring_appointment_occurrence_skips (
  id uuid primary key default gen_random_uuid(),
  recurring_rule_id uuid not null references public.recurring_appointment_rules(id) on delete cascade,
  starts_at timestamptz not null,
  visit_id uuid references public.tenant_scheduled_visits(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint recurring_occurrence_skips_rule_starts unique (recurring_rule_id, starts_at)
);

create index recurring_occurrence_skips_rule_idx
  on public.recurring_appointment_occurrence_skips (recurring_rule_id);

comment on table public.recurring_appointment_occurrence_skips is
  'Original RRULE occurrence instants that should not be re-materialized after reschedule or delete.';
