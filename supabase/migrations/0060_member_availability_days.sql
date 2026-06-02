-- =============================================================================
-- 0060_member_availability_days.sql
-- Per-weekday work windows for employee availability.
-- =============================================================================

create table public.tenant_member_availability_days (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null,
  weekday text not null,
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id, weekday),
  constraint tenant_member_availability_days_weekday check (
    weekday in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
  ),
  constraint tenant_member_availability_days_window check (ends_at > starts_at),
  constraint tenant_member_availability_days_user_fkey
    foreign key (user_id) references public.user_profiles (user_id) on delete cascade
);

create trigger tenant_member_availability_days_set_updated_at
before update on public.tenant_member_availability_days
for each row execute procedure public.set_updated_at();

create index tenant_member_availability_days_user_idx
  on public.tenant_member_availability_days (user_id);

comment on table public.tenant_member_availability_days is
  'Per-weekday work windows when member schedule profile use_tenant_default is false.';

-- Backfill from legacy single-window profile columns.
insert into public.tenant_member_availability_days (tenant_id, user_id, weekday, starts_at, ends_at)
select
  p.tenant_id,
  p.user_id,
  d.day,
  p.work_day_start,
  p.work_day_end
from public.tenant_member_schedule_profiles p
cross join lateral unnest(p.work_week_days) as d(day)
where p.use_tenant_default = false
  and cardinality(p.work_week_days) > 0
on conflict (tenant_id, user_id, weekday) do nothing;

alter table public.tenant_member_schedule_profiles
  drop column if exists work_week_days,
  drop column if exists work_day_start,
  drop column if exists work_day_end;

revoke all on table public.tenant_member_availability_days from anon, authenticated;
grant select, insert, update, delete on table public.tenant_member_availability_days to service_role;
