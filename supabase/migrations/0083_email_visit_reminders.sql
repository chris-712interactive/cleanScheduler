-- =============================================================================
-- 0083_email_visit_reminders.sql
-- Opt-in email visit reminders (~24h before) + dedupe log.
-- =============================================================================

alter table public.tenant_operational_settings
  add column if not exists email_notify_visit_reminder boolean not null default false;

comment on column public.tenant_operational_settings.email_notify_visit_reminder is
  'When true, send ~24h-before visit reminder emails (all plans with emailVisitReminders).';

create type public.visit_reminder_channel as enum ('email', 'sms');

create table if not exists public.tenant_visit_reminder_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  visit_id uuid not null references public.tenant_scheduled_visits (id) on delete cascade,
  channel public.visit_reminder_channel not null,
  created_at timestamptz not null default now(),
  constraint tenant_visit_reminder_log_unique unique (tenant_id, visit_id, channel)
);

create index if not exists tenant_visit_reminder_log_tenant_created_idx
  on public.tenant_visit_reminder_log (tenant_id, created_at desc);

comment on table public.tenant_visit_reminder_log is
  'Dedupes visit reminder sends per channel so cron jobs do not re-notify.';

alter table public.tenant_visit_reminder_log enable row level security;

revoke all on table public.tenant_visit_reminder_log from anon, authenticated;
grant select, insert, update, delete on table public.tenant_visit_reminder_log to service_role;
