-- =============================================================================
-- 0074_quote_pipeline_stages.sql
-- Customizable quote Kanban pipeline stages per tenant.
-- =============================================================================

create table public.tenant_quote_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null,
  is_hidden boolean not null default false,
  is_system boolean not null default false,
  system_status public.quote_status,
  on_enter_status public.quote_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_quote_pipeline_stages_sort_nonneg check (sort_order >= 0),
  constraint tenant_quote_pipeline_stages_system_status_unique unique (tenant_id, system_status)
);

create index tenant_quote_pipeline_stages_tenant_sort_idx
  on public.tenant_quote_pipeline_stages (tenant_id, sort_order);

create trigger tenant_quote_pipeline_stages_set_updated_at
before update on public.tenant_quote_pipeline_stages
for each row execute procedure public.set_updated_at();

alter table public.tenant_quotes
  add column pipeline_stage_id uuid references public.tenant_quote_pipeline_stages(id) on delete restrict;

-- Seed default system stages for every tenant
insert into public.tenant_quote_pipeline_stages (
  tenant_id,
  name,
  sort_order,
  is_hidden,
  is_system,
  system_status,
  on_enter_status
)
select
  t.id,
  stage.name,
  stage.sort_order,
  false,
  true,
  stage.system_status,
  stage.system_status
from public.tenants t
cross join (
  values
    ('Draft', 0, 'draft'::public.quote_status),
    ('Sent', 1, 'sent'::public.quote_status),
    ('Accepted', 2, 'accepted'::public.quote_status),
    ('Declined', 3, 'declined'::public.quote_status),
    ('Expired', 4, 'expired'::public.quote_status)
) as stage(name, sort_order, system_status);

-- Backfill pipeline_stage_id for all quotes, including expired rows. The expired-immutability
-- trigger blocks any UPDATE on expired quotes; disable it for this one-time migration only.
alter table public.tenant_quotes disable trigger tenant_quotes_07_reject_mutations_when_expired;

update public.tenant_quotes q
set pipeline_stage_id = s.id
from public.tenant_quote_pipeline_stages s
where s.tenant_id = q.tenant_id
  and s.system_status = q.status;

alter table public.tenant_quotes enable trigger tenant_quotes_07_reject_mutations_when_expired;

alter table public.tenant_quotes
  alter column pipeline_stage_id set not null;

create index tenant_quotes_pipeline_stage_idx
  on public.tenant_quotes (pipeline_stage_id);

alter table public.tenant_quote_pipeline_stages enable row level security;

create policy "tenant_quote_pipeline_stages_member_all"
  on public.tenant_quote_pipeline_stages
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.tenant_quote_pipeline_stages to service_role;
