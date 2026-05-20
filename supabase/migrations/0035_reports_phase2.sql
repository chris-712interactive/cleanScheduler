-- Phase 2 reports: compensation rules + visit index for labor reports.

create table public.compensation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  rule_type text not null check (
    rule_type in ('commission_percent_bps', 'tip_split_percent_bps', 'flat_per_job_cents')
  ),
  percent_bps int,
  flat_cents int,
  applies_to_role text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index compensation_rules_tenant_active_idx
  on public.compensation_rules (tenant_id, is_active);

alter table public.compensation_rules enable row level security;

create policy "compensation_rules_member_read"
  on public.compensation_rules
  for select
  to authenticated
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "compensation_rules_admin_write"
  on public.compensation_rules
  for all
  to authenticated
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.compensation_rules to service_role;

create index tenant_scheduled_visits_tenant_completed_idx
  on public.tenant_scheduled_visits (tenant_id, completed_at desc)
  where status = 'completed';
