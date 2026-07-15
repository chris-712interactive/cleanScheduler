-- =============================================================================
-- 0086_value_everywhere_pack.sql
-- Visit checklists, guest invoice pay tokens, richer booking lead fields.
-- =============================================================================

-- Visit checklist templates on service types
alter table public.tenant_service_templates
  add column if not exists checklist_items jsonb not null default '[]'::jsonb;

comment on column public.tenant_service_templates.checklist_items is
  'Ordered checklist template items [{id, label}] for field crews (max ~20).';

create table if not exists public.tenant_visit_checklist_state (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  visit_id uuid not null references public.tenant_scheduled_visits (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tenant_visit_checklist_state_visit_unique unique (tenant_id, visit_id)
);

create index if not exists tenant_visit_checklist_state_tenant_idx
  on public.tenant_visit_checklist_state (tenant_id);

comment on table public.tenant_visit_checklist_state is
  'Per-visit checklist progress copied from the service-type template.';

alter table public.tenant_visit_checklist_state enable row level security;

revoke all on table public.tenant_visit_checklist_state from anon, authenticated;
grant select, insert, update, delete on table public.tenant_visit_checklist_state to service_role;

-- Guest invoice pay tokens (Starter / no customer portal)
create table if not exists public.tenant_invoice_pay_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.tenant_invoices (id) on delete cascade,
  token text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint tenant_invoice_pay_tokens_token_unique unique (token)
);

create index if not exists tenant_invoice_pay_tokens_invoice_idx
  on public.tenant_invoice_pay_tokens (tenant_id, invoice_id);

comment on table public.tenant_invoice_pay_tokens is
  'One-time / expiring guest pay links for invoices when customer portal is off.';

alter table public.tenant_invoice_pay_tokens enable row level security;

revoke all on table public.tenant_invoice_pay_tokens from anon, authenticated;
grant select, insert, update, delete on table public.tenant_invoice_pay_tokens to service_role;

-- Richer public booking request fields
alter table public.tenant_marketing_leads
  add column if not exists service_interest text null,
  add column if not exists preferred_time_window text null;

comment on column public.tenant_marketing_leads.service_interest is
  'Optional service type interest from the public /book form.';

comment on column public.tenant_marketing_leads.preferred_time_window is
  'Optional preferred time window: morning | afternoon | evening | flexible.';
