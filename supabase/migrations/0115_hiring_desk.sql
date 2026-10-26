-- =============================================================================
-- 0115_hiring_desk.sql
-- Business+ hiring desk (phase 1): openings, slots, applications, email holds.
-- Applicants are not workspace members and are never visit assignees.
-- =============================================================================

create table public.tenant_hiring_openings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  kind text not null,
  status text not null default 'draft',
  pay_text text not null default '',
  schedule_text text not null default '',
  area_text text not null default '',
  interview_kind text not null default 'phone',
  confirm_window_minutes integer not null default 180,
  require_transportation boolean not null default true,
  require_accepts_pay boolean not null default true,
  require_accepts_schedule boolean not null default true,
  require_background_check_willing boolean not null default true,
  require_work_authorized boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_hiring_openings_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint tenant_hiring_openings_kind_check check (kind in ('field', 'office')),
  constraint tenant_hiring_openings_status_check check (status in ('draft', 'open', 'closed')),
  constraint tenant_hiring_openings_interview_kind_check check (
    interview_kind in ('phone', 'office', 'paid_shadow')
  ),
  constraint tenant_hiring_openings_confirm_window_check check (
    confirm_window_minutes between 30 and 1440
  ),
  unique (tenant_id, slug)
);

create index tenant_hiring_openings_tenant_status_idx
  on public.tenant_hiring_openings (tenant_id, status);

create trigger tenant_hiring_openings_set_updated_at
before update on public.tenant_hiring_openings
for each row execute procedure public.set_updated_at();

create table public.tenant_hiring_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opening_id uuid not null references public.tenant_hiring_openings(id) on delete cascade,
  full_name text,
  email text,
  phone_e164 text,
  status text not null default 'ready',
  gate_answers jsonb not null default '{}'::jsonb,
  applicant_note text,
  consent_at timestamptz,
  consent_version text,
  source text not null default 'public_form',
  invite_token uuid references public.employee_invites(token) on delete set null,
  hired_user_id uuid,
  screened_out_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_hiring_applications_status_check check (
    status in (
      'ready',
      'screened_out',
      'slot_offered',
      'confirmed',
      'offer_expired',
      'declined',
      'showed',
      'no_show',
      'rejected',
      'hired',
      'withdrawn'
    )
  ),
  constraint tenant_hiring_applications_source_check check (
    source in ('public_form', 'office_link')
  )
);

create unique index tenant_hiring_applications_opening_email_uidx
  on public.tenant_hiring_applications (opening_id, email)
  where email is not null;

create unique index tenant_hiring_applications_opening_phone_uidx
  on public.tenant_hiring_applications (opening_id, phone_e164)
  where phone_e164 is not null;

create index tenant_hiring_applications_opening_status_idx
  on public.tenant_hiring_applications (opening_id, status, created_at);

create index tenant_hiring_applications_tenant_status_idx
  on public.tenant_hiring_applications (tenant_id, status);

create trigger tenant_hiring_applications_set_updated_at
before update on public.tenant_hiring_applications
for each row execute procedure public.set_updated_at();

create table public.tenant_hiring_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opening_id uuid not null references public.tenant_hiring_openings(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30,
  meeting_text text not null default '',
  held_by_application_id uuid references public.tenant_hiring_applications(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tenant_hiring_slots_duration_check check (duration_minutes between 15 and 480)
);

create unique index tenant_hiring_slots_held_by_uidx
  on public.tenant_hiring_slots (held_by_application_id)
  where held_by_application_id is not null;

create index tenant_hiring_slots_opening_starts_idx
  on public.tenant_hiring_slots (opening_id, starts_at);

create table public.tenant_hiring_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opening_id uuid not null references public.tenant_hiring_openings(id) on delete cascade,
  application_id uuid references public.tenant_hiring_applications(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid,
  detail text,
  created_at timestamptz not null default now(),
  constraint tenant_hiring_events_type_check check (
    event_type in (
      'applied',
      'screened_out',
      'offered',
      'confirmed',
      'expired',
      'declined',
      'reminded',
      'showed',
      'no_show',
      'rejected',
      'hired',
      'withdrawn',
      'deleted',
      'mail_failed',
      'canceled',
      'override',
      'csv_downloaded',
      'link_sent',
      'office_waiting'
    )
  )
);

create index tenant_hiring_events_opening_created_idx
  on public.tenant_hiring_events (opening_id, created_at desc);

create index tenant_hiring_events_application_created_idx
  on public.tenant_hiring_events (application_id, created_at desc);

create table public.tenant_hiring_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.tenant_hiring_applications(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tenant_hiring_tokens_purpose_check check (
    purpose in ('confirm', 'decline', 'withdraw')
  )
);

create index tenant_hiring_tokens_application_idx
  on public.tenant_hiring_tokens (application_id, purpose);

create table public.tenant_hiring_submit_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opening_id uuid not null references public.tenant_hiring_openings(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index tenant_hiring_submit_attempts_opening_ip_idx
  on public.tenant_hiring_submit_attempts (opening_id, ip_hash, created_at desc);

create index tenant_hiring_submit_attempts_tenant_ip_idx
  on public.tenant_hiring_submit_attempts (tenant_id, ip_hash, created_at desc);

comment on table public.tenant_hiring_applications is
  'Applicant PII for one cleaning company. Not a workspace member and not a visit assignee.';

-- Owner and admin system roles can open the desk. Custom roles opt in.
insert into public.tenant_role_permissions (role_id, permission_key)
select tr.id, p.key
from public.tenant_roles tr
cross join (
  values ('hiring.view'), ('hiring.manage')
) as p(key)
where tr.is_system = true
  and tr.slug in ('owner', 'admin')
on conflict do nothing;

create or replace function public.seed_tenant_system_roles_for_tenant()
returns trigger
language plpgsql
as $$
declare
  role_rec record;
  role_id uuid;
begin
  for role_rec in
    select *
    from (
      values
        ('Owner', 'owner', 'Full workspace control including billing and team management.', 'owner'::public.tenant_role),
        ('Admin', 'admin', 'Day-to-day workspace administration without ownership transfer.', 'admin'::public.tenant_role),
        ('Field employee', 'employee', 'Mobile-first access for crew — assigned jobs and proof photos.', 'employee'::public.tenant_role),
        ('Viewer', 'viewer', 'Read-only access for stakeholders who need visibility without changes.', 'viewer'::public.tenant_role)
    ) as defs(name, slug, description, base_role)
  loop
    insert into public.tenant_roles (tenant_id, name, slug, description, base_role, is_system)
    values (new.id, role_rec.name, role_rec.slug, role_rec.description, role_rec.base_role, true)
    returning id into role_id;

    if role_rec.slug in ('owner', 'admin') then
      insert into public.tenant_role_permissions (role_id, permission_key)
      select role_id, p.key
      from (
        values
          ('quotes.view'),
          ('quotes.manage'),
          ('billing.view'),
          ('billing.manage'),
          ('team.view'),
          ('team.invite'),
          ('team.manage_roles'),
          ('team.manage_members'),
          ('settings.view'),
          ('settings.operations'),
          ('settings.business'),
          ('messages.view'),
          ('messages.reply'),
          ('schedule.view'),
          ('schedule.manage'),
          ('customers.view'),
          ('customers.manage'),
          ('reports.view'),
          ('reports.export'),
          ('campaigns.view'),
          ('campaigns.manage'),
          ('hiring.view'),
          ('hiring.manage')
      ) as p(key);
    elsif role_rec.slug = 'employee' then
      insert into public.tenant_role_permissions (role_id, permission_key)
      values
        (role_id, 'schedule.view'),
        (role_id, 'settings.view');
    elsif role_rec.slug = 'viewer' then
      insert into public.tenant_role_permissions (role_id, permission_key)
      values
        (role_id, 'quotes.view'),
        (role_id, 'customers.view'),
        (role_id, 'schedule.view'),
        (role_id, 'team.view'),
        (role_id, 'messages.view'),
        (role_id, 'settings.view');
    end if;
  end loop;

  return new;
end;
$$;

-- RLS: members of this tenant with hiring access (or owner/admin) may read.
-- Writes go through the service role. A second tenant's membership does not match.

create or replace function public.can_read_hiring_desk(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = target_tenant_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
        and (
          tm.role in ('owner', 'admin')
          or exists (
            select 1
            from public.tenant_role_permissions trp
            where trp.role_id = tm.role_id
              and trp.permission_key in ('hiring.view', 'hiring.manage')
          )
        )
    );
$$;

alter table public.tenant_hiring_openings enable row level security;
alter table public.tenant_hiring_applications enable row level security;
alter table public.tenant_hiring_slots enable row level security;
alter table public.tenant_hiring_events enable row level security;
alter table public.tenant_hiring_tokens enable row level security;
alter table public.tenant_hiring_submit_attempts enable row level security;

create policy tenant_hiring_openings_member_read
  on public.tenant_hiring_openings
  for select
  using (public.can_read_hiring_desk(tenant_id));

create policy tenant_hiring_applications_member_read
  on public.tenant_hiring_applications
  for select
  using (public.can_read_hiring_desk(tenant_id));

create policy tenant_hiring_slots_member_read
  on public.tenant_hiring_slots
  for select
  using (public.can_read_hiring_desk(tenant_id));

create policy tenant_hiring_events_member_read
  on public.tenant_hiring_events
  for select
  using (public.can_read_hiring_desk(tenant_id));

revoke all on table public.tenant_hiring_openings from anon, authenticated;
revoke all on table public.tenant_hiring_applications from anon, authenticated;
revoke all on table public.tenant_hiring_slots from anon, authenticated;
revoke all on table public.tenant_hiring_events from anon, authenticated;
revoke all on table public.tenant_hiring_tokens from anon, authenticated;
revoke all on table public.tenant_hiring_submit_attempts from anon, authenticated;

grant select on table public.tenant_hiring_openings to authenticated;
grant select on table public.tenant_hiring_applications to authenticated;
grant select on table public.tenant_hiring_slots to authenticated;
grant select on table public.tenant_hiring_events to authenticated;

grant select, insert, update, delete on table public.tenant_hiring_openings to service_role;
grant select, insert, update, delete on table public.tenant_hiring_applications to service_role;
grant select, insert, update, delete on table public.tenant_hiring_slots to service_role;
grant select, insert, update, delete on table public.tenant_hiring_events to service_role;
grant select, insert, update, delete on table public.tenant_hiring_tokens to service_role;
grant select, insert, update, delete on table public.tenant_hiring_submit_attempts to service_role;
