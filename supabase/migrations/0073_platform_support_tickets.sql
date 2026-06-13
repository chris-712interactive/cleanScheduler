-- =============================================================================
-- 0073_platform_support_tickets.sql
-- Platform support tickets: tenants contact Clean Scheduler; founder admin inbox.
-- =============================================================================

create type public.platform_support_ticket_status as enum (
  'open',
  'waiting_on_tenant',
  'waiting_on_platform',
  'resolved',
  'closed'
);

create type public.platform_support_ticket_category as enum (
  'billing',
  'technical',
  'account',
  'other'
);

create type public.platform_support_message_side as enum (
  'tenant',
  'platform'
);

create table public.platform_support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subject text not null,
  status public.platform_support_ticket_status not null default 'open',
  category public.platform_support_ticket_category not null default 'other',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index platform_support_tickets_tenant_updated_idx
  on public.platform_support_tickets (tenant_id, updated_at desc);

create index platform_support_tickets_status_updated_idx
  on public.platform_support_tickets (status, updated_at desc);

create trigger platform_support_tickets_set_updated_at
before update on public.platform_support_tickets
for each row execute procedure public.set_updated_at();

create table public.platform_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.platform_support_tickets(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_side public.platform_support_message_side not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index platform_support_messages_ticket_idx
  on public.platform_support_messages (ticket_id, created_at);

-- RLS helpers
create or replace function public.is_tenant_owner_or_admin(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('owner'::public.tenant_role, 'admin'::public.tenant_role)
  );
$$;

create or replace function public.platform_support_ticket_is_open(p_status public.platform_support_ticket_status)
returns boolean
language sql
immutable
as $$
  select p_status not in (
    'resolved'::public.platform_support_ticket_status,
    'closed'::public.platform_support_ticket_status
  );
$$;

alter table public.platform_support_tickets enable row level security;
alter table public.platform_support_messages enable row level security;

-- Tickets: platform admins full access; tenant owner/admin read + insert + update own tenant
create policy "platform_support_tickets_admin_all"
  on public.platform_support_tickets
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "platform_support_tickets_tenant_read"
  on public.platform_support_tickets
  for select
  using (public.is_tenant_owner_or_admin(tenant_id));

create policy "platform_support_tickets_tenant_insert"
  on public.platform_support_tickets
  for insert
  with check (
    public.is_tenant_owner_or_admin(tenant_id)
    and created_by_user_id = auth.uid()
  );

create policy "platform_support_tickets_tenant_update"
  on public.platform_support_tickets
  for update
  using (public.is_tenant_owner_or_admin(tenant_id))
  with check (public.is_tenant_owner_or_admin(tenant_id));

-- Messages
create policy "platform_support_messages_admin_all"
  on public.platform_support_messages
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "platform_support_messages_tenant_read"
  on public.platform_support_messages
  for select
  using (
    exists (
      select 1
      from public.platform_support_tickets t
      where t.id = platform_support_messages.ticket_id
        and public.is_tenant_owner_or_admin(t.tenant_id)
    )
  );

create policy "platform_support_messages_tenant_insert"
  on public.platform_support_messages
  for insert
  with check (
    author_side = 'tenant'::public.platform_support_message_side
    and exists (
      select 1
      from public.platform_support_tickets t
      where t.id = platform_support_messages.ticket_id
        and public.is_tenant_owner_or_admin(t.tenant_id)
        and public.platform_support_ticket_is_open(t.status)
    )
  );

grant select, insert, update, delete on table public.platform_support_tickets to service_role;
grant select, insert, update, delete on table public.platform_support_messages to service_role;
