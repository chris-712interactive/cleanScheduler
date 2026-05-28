-- =============================================================================
-- 0015_scheduled_visit_assignees.sql
-- =============================================================================
-- Crew assignment: which workspace members are scheduled on a visit.

create table public.tenant_scheduled_visit_assignees (
  visit_id uuid not null references public.tenant_scheduled_visits(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (visit_id, user_id),
  constraint tenant_scheduled_visit_assignees_user_id_fkey
    foreign key (user_id) references public.user_profiles(user_id) on delete cascade
);

create index tenant_scheduled_visit_assignees_visit_idx
  on public.tenant_scheduled_visit_assignees (visit_id);

create index tenant_scheduled_visit_assignees_user_idx
  on public.tenant_scheduled_visit_assignees (user_id);

create or replace function public.enforce_visit_assignee_membership()
returns trigger
language plpgsql
as $$
declare
  tid uuid;
begin
  select v.tenant_id
    into tid
  from public.tenant_scheduled_visits v
  where v.id = new.visit_id;

  if tid is null then
    raise exception 'tenant_scheduled_visit_assignees: visit not found';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = tid
      and tm.user_id = new.user_id
      and tm.is_active
  ) then
    raise exception 'tenant_scheduled_visit_assignees: user must be an active member of this workspace';
  end if;

  return new;
end;
$$;

create trigger tenant_scheduled_visit_assignees_membership
before insert or update of visit_id, user_id on public.tenant_scheduled_visit_assignees
for each row execute procedure public.enforce_visit_assignee_membership();

revoke all on table public.tenant_scheduled_visit_assignees from anon;
revoke all on table public.tenant_scheduled_visit_assignees from authenticated;
grant select, insert, update, delete on table public.tenant_scheduled_visit_assignees to service_role;
