-- =============================================================================
-- 0114_employee_hours_policy.sql
-- Office control over field-employee weekly hours.
-- =============================================================================

alter table public.tenant_operational_settings
  add column employees_can_edit_own_hours boolean not null default true,
  add column employee_hours_require_approval boolean not null default false;

comment on column public.tenant_operational_settings.employees_can_edit_own_hours is
  'When false, a field employee cannot change their own weekly hours.';

comment on column public.tenant_operational_settings.employee_hours_require_approval is
  'When true, a field employee hour change stays pending until an owner or admin approves it.';

create table public.tenant_member_availability_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null,
  status public.tenant_time_off_status not null default 'pending',
  use_tenant_default boolean not null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_member_availability_change_requests_user_fkey
    foreign key (user_id) references public.user_profiles (user_id) on delete cascade
);

create trigger tenant_member_availability_change_requests_set_updated_at
before update on public.tenant_member_availability_change_requests
for each row execute procedure public.set_updated_at();

create index tenant_member_availability_change_requests_tenant_status_idx
  on public.tenant_member_availability_change_requests (tenant_id, status, requested_at);

create unique index tenant_member_availability_change_requests_one_pending
  on public.tenant_member_availability_change_requests (tenant_id, user_id)
  where status = 'pending';

comment on table public.tenant_member_availability_change_requests is
  'Proposed weekly hours. Pending rows do not affect the schedule until approved.';

create table public.tenant_member_availability_change_request_days (
  request_id uuid not null references public.tenant_member_availability_change_requests (id) on delete cascade,
  weekday text not null,
  starts_at time not null,
  ends_at time not null,
  primary key (request_id, weekday),
  constraint tenant_member_availability_change_request_days_weekday check (
    weekday in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
  ),
  constraint tenant_member_availability_change_request_days_window check (ends_at > starts_at)
);

comment on table public.tenant_member_availability_change_request_days is
  'Proposed weekday windows for an hour-change request that does not use company hours.';

revoke all on table public.tenant_member_availability_change_requests from anon, authenticated;
revoke all on table public.tenant_member_availability_change_request_days from anon, authenticated;
grant select, insert, update, delete on table public.tenant_member_availability_change_requests to service_role;
grant select, insert, update, delete on table public.tenant_member_availability_change_request_days to service_role;
