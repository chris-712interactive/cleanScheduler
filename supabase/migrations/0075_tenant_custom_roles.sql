-- =============================================================================
-- 0075_tenant_custom_roles.sql
-- Tenant-defined roles with permission keys; memberships link via role_id.
-- =============================================================================

create table public.tenant_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  base_role public.tenant_role not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_roles_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  unique (tenant_id, slug)
);

create index tenant_roles_tenant_id_idx on public.tenant_roles (tenant_id);

create trigger tenant_roles_set_updated_at
before update on public.tenant_roles
for each row execute procedure public.set_updated_at();

create table public.tenant_role_permissions (
  role_id uuid not null references public.tenant_roles(id) on delete cascade,
  permission_key text not null,
  primary key (role_id, permission_key)
);

create index tenant_role_permissions_role_id_idx
  on public.tenant_role_permissions (role_id);

alter table public.tenant_memberships
  add column role_id uuid references public.tenant_roles(id) on delete restrict;

create index tenant_memberships_role_id_idx on public.tenant_memberships (role_id);

-- Seed system roles for every existing tenant
insert into public.tenant_roles (tenant_id, name, slug, description, base_role, is_system)
select
  t.id,
  defs.name,
  defs.slug,
  defs.description,
  defs.base_role,
  true
from public.tenants t
cross join (
  values
    ('Owner', 'owner', 'Full workspace control including billing and team management.', 'owner'::public.tenant_role),
    ('Admin', 'admin', 'Day-to-day workspace administration without ownership transfer.', 'admin'::public.tenant_role),
    ('Field employee', 'employee', 'Mobile-first access for crew — assigned jobs and proof photos.', 'employee'::public.tenant_role),
    ('Viewer', 'viewer', 'Read-only access for stakeholders who need visibility without changes.', 'viewer'::public.tenant_role)
) as defs(name, slug, description, base_role);

-- Default permission grants for system roles (mirrors lib/tenant/permissionCatalog.ts)
insert into public.tenant_role_permissions (role_id, permission_key)
select tr.id, p.permission_key
from public.tenant_roles tr
cross join (
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
    ('campaigns.manage')
) as p(permission_key)
where tr.is_system = true
  and tr.slug in ('owner', 'admin');

insert into public.tenant_role_permissions (role_id, permission_key)
select tr.id, p.permission_key
from public.tenant_roles tr
cross join (
  values
    ('schedule.view'),
    ('settings.view')
) as p(permission_key)
where tr.is_system = true
  and tr.slug = 'employee';

insert into public.tenant_role_permissions (role_id, permission_key)
select tr.id, p.permission_key
from public.tenant_roles tr
cross join (
  values
    ('quotes.view'),
    ('customers.view'),
    ('schedule.view'),
    ('team.view'),
    ('messages.view'),
    ('settings.view')
) as p(permission_key)
where tr.is_system = true
  and tr.slug = 'viewer';

-- Backfill membership role_id from legacy enum column
update public.tenant_memberships tm
set role_id = tr.id
from public.tenant_roles tr
where tr.tenant_id = tm.tenant_id
  and tr.is_system = true
  and tr.slug = tm.role::text;

-- Resolve role_id from legacy enum when inserts omit role_id (onboarding, invites)
create or replace function public.sync_tenant_membership_role_id_from_role()
returns trigger
language plpgsql
as $$
begin
  if new.role_id is null and new.role is not null then
    select tr.id
    into new.role_id
    from public.tenant_roles tr
    where tr.tenant_id = new.tenant_id
      and tr.is_system = true
      and tr.slug = new.role::text;
  end if;

  return new;
end;
$$;

create trigger tenant_memberships_sync_role_id_from_role
before insert or update of role on public.tenant_memberships
for each row execute procedure public.sync_tenant_membership_role_id_from_role();

-- Keep tenant_memberships.role enum synced from role_id for JWT / legacy helpers
create or replace function public.sync_tenant_membership_role_from_role_id()
returns trigger
language plpgsql
as $$
declare
  resolved_base_role public.tenant_role;
begin
  if new.role_id is not null then
    select tr.base_role
    into resolved_base_role
    from public.tenant_roles tr
    where tr.id = new.role_id;

    if resolved_base_role is null then
      raise exception 'tenant_roles row not found for role_id %', new.role_id;
    end if;

    new.role := resolved_base_role;
  end if;

  return new;
end;
$$;

create trigger tenant_memberships_sync_role_from_role_id
before insert or update of role_id on public.tenant_memberships
for each row execute procedure public.sync_tenant_membership_role_from_role_id();

-- Seed system roles when a new tenant is created
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
          ('campaigns.manage')
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

create trigger tenants_seed_system_roles
after insert on public.tenants
for each row execute procedure public.seed_tenant_system_roles_for_tenant();

-- RLS
alter table public.tenant_roles enable row level security;
alter table public.tenant_role_permissions enable row level security;

create policy "tenant_roles_member_read"
  on public.tenant_roles
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_roles_admin_write"
  on public.tenant_roles
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_role_permissions_member_read"
  on public.tenant_role_permissions
  for select
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_roles tr
      where tr.id = role_id
        and public.has_tenant_membership(tr.tenant_id)
    )
  );

create policy "tenant_role_permissions_admin_write"
  on public.tenant_role_permissions
  for all
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_roles tr
      where tr.id = role_id
        and public.has_tenant_membership(tr.tenant_id)
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_roles tr
      where tr.id = role_id
        and public.has_tenant_membership(tr.tenant_id)
    )
  );

grant select, insert, update, delete on table public.tenant_roles to service_role;
grant select, insert, update, delete on table public.tenant_role_permissions to service_role;
