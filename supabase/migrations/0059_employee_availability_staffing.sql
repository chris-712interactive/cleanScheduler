-- =============================================================================
-- 0059_employee_availability_staffing.sql
-- Member work windows, time off, and visit staffing status for auto-scheduling.
-- =============================================================================

create type public.tenant_time_off_status as enum (
  'pending',
  'approved',
  'denied',
  'cancelled'
);

create type public.visit_staffing_status as enum (
  'assigned',
  'needs_staffing',
  'override_confirmed'
);

-- Per-member schedule profile (inherits tenant business hours when use_tenant_default).
create table public.tenant_member_schedule_profiles (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null,
  use_tenant_default boolean not null default true,
  work_week_days text[] not null default '{}'::text[],
  work_day_start time not null default '08:00',
  work_day_end time not null default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint tenant_member_schedule_profiles_user_fkey
    foreign key (user_id) references public.user_profiles (user_id) on delete cascade
);

create trigger tenant_member_schedule_profiles_set_updated_at
before update on public.tenant_member_schedule_profiles
for each row execute procedure public.set_updated_at();

create index tenant_member_schedule_profiles_user_idx
  on public.tenant_member_schedule_profiles (user_id);

comment on table public.tenant_member_schedule_profiles is
  'Optional per-employee work windows; when use_tenant_default is true, tenant business hours apply.';

-- Time off requests (employee-initiated, admin-reviewed).
create table public.tenant_member_time_off (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.tenant_time_off_status not null default 'pending',
  request_note text not null default '',
  review_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_member_time_off_window check (ends_at > starts_at),
  constraint tenant_member_time_off_user_fkey
    foreign key (user_id) references public.user_profiles (user_id) on delete cascade
);

create trigger tenant_member_time_off_set_updated_at
before update on public.tenant_member_time_off
for each row execute procedure public.set_updated_at();

create index tenant_member_time_off_tenant_status_idx
  on public.tenant_member_time_off (tenant_id, status, starts_at);

create index tenant_member_time_off_user_idx
  on public.tenant_member_time_off (user_id, starts_at desc);

-- Visit staffing state for auto-schedule and office queue.
alter table public.tenant_scheduled_visits
  add column if not exists staffing_status public.visit_staffing_status not null default 'needs_staffing';

create index tenant_scheduled_visits_staffing_idx
  on public.tenant_scheduled_visits (tenant_id, staffing_status, starts_at)
  where status = 'scheduled';

-- Existing visits with assignees count as assigned.
update public.tenant_scheduled_visits v
set staffing_status = 'assigned'::public.visit_staffing_status
where exists (
  select 1
  from public.tenant_scheduled_visit_assignees a
  where a.visit_id = v.id
);

revoke all on table public.tenant_member_schedule_profiles from anon, authenticated;
revoke all on table public.tenant_member_time_off from anon, authenticated;
grant select, insert, update, delete on table public.tenant_member_schedule_profiles to service_role;
grant select, insert, update, delete on table public.tenant_member_time_off to service_role;
