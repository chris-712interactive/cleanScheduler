-- =============================================================================
-- 0029_visit_reschedule_requests.sql
-- Customer reschedule requests + tenant acknowledgment fields.
-- =============================================================================

create type public.visit_reschedule_request_status as enum (
  'pending',
  'completed',
  'declined',
  'withdrawn'
);

create table public.visit_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  visit_id uuid not null references public.tenant_scheduled_visits(id) on delete cascade,
  status public.visit_reschedule_request_status not null default 'pending',
  customer_note text not null default '',
  preferred_starts_at timestamptz,
  preferred_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  tenant_response_note text,
  constraint visit_reschedule_preferred_window check (
    preferred_ends_at is null
    or preferred_starts_at is null
    or preferred_ends_at >= preferred_starts_at
  )
);

create index visit_reschedule_requests_tenant_status_idx
  on public.visit_reschedule_requests (tenant_id, status, created_at desc);

create index visit_reschedule_requests_customer_idx
  on public.visit_reschedule_requests (customer_id, created_at desc);

create unique index visit_reschedule_one_pending_per_visit
  on public.visit_reschedule_requests (visit_id)
  where status = 'pending';

create trigger visit_reschedule_requests_set_updated_at
before update on public.visit_reschedule_requests
for each row execute procedure public.set_updated_at();

alter table public.visit_reschedule_requests enable row level security;

-- Tenant members + platform admins
create policy "visit_reschedule_requests_member_all"
  on public.visit_reschedule_requests
  for all
  using (
    public.is_platform_admin()
    or public.has_tenant_membership(tenant_id)
  )
  with check (
    public.is_platform_admin()
    or public.has_tenant_membership(tenant_id)
  );

-- Customer read
create policy "visit_reschedule_requests_customer_read"
  on public.visit_reschedule_requests
  for select
  using (
    exists (
      select 1
      from public.customers c
      join public.customer_identities ci on ci.id = c.customer_identity_id
      where c.id = visit_reschedule_requests.customer_id
        and ci.auth_user_id = auth.uid()
    )
  );

-- Customer creates request for their linked customer row
create policy "visit_reschedule_requests_customer_insert"
  on public.visit_reschedule_requests
  for insert
  with check (
    exists (
      select 1
      from public.customers c
      join public.customer_identities ci on ci.id = c.customer_identity_id
      join public.tenant_scheduled_visits v on v.id = visit_reschedule_requests.visit_id
      where c.id = visit_reschedule_requests.customer_id
        and ci.auth_user_id = auth.uid()
        and visit_reschedule_requests.customer_id = c.id
        and visit_reschedule_requests.tenant_id = c.tenant_id
        and v.customer_id = c.id
        and v.tenant_id = c.tenant_id
    )
  );

grant select, insert, update, delete on table public.visit_reschedule_requests to service_role;
