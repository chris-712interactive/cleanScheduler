-- =============================================================================
-- 0018_tenant_operational_settings.sql
-- =============================================================================
-- Per-tenant workflow defaults: after quote acceptance, invoice expectations,
-- and which payment methods customers may use during acceptance / pay flows.
-- See docs/product/quotes-line-items.md (tenant settings backlog).

create type public.accepted_quote_schedule_mode as enum (
  'prompt_staff',
  'auto_schedule'
);

create type public.tenant_invoice_expectation as enum (
  'prepay',
  'pay_after_service'
);

create table public.tenant_operational_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  accepted_quote_schedule_mode public.accepted_quote_schedule_mode not null default 'prompt_staff',
  invoice_expectation public.tenant_invoice_expectation not null default 'pay_after_service',
  allowed_customer_payment_methods text[] not null default array['card', 'cash', 'check', 'zelle']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_op_settings_payment_methods_nonempty
    check (cardinality(allowed_customer_payment_methods) >= 1),
  constraint tenant_op_settings_payment_methods_whitelist
    check (
      allowed_customer_payment_methods <@ array['cash', 'check', 'zelle', 'card', 'ach', 'other']::text[]
    )
);

create index tenant_operational_settings_tenant_idx
  on public.tenant_operational_settings (tenant_id);

create trigger tenant_operational_settings_set_updated_at
before update on public.tenant_operational_settings
for each row execute procedure public.set_updated_at();

-- Seed a settings row for every existing tenant
insert into public.tenant_operational_settings (tenant_id)
select t.id
from public.tenants t
where not exists (
  select 1 from public.tenant_operational_settings s where s.tenant_id = t.id
);

-- New tenants: create default operational settings
create or replace function public.tenants_seed_operational_settings()
returns trigger
language plpgsql
as $$
begin
  insert into public.tenant_operational_settings (tenant_id)
  values (new.id)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

create trigger tenants_02_seed_operational_settings
after insert on public.tenants
for each row execute procedure public.tenants_seed_operational_settings();

alter table public.tenant_operational_settings enable row level security;

create policy "tenant_operational_settings_member_read"
  on public.tenant_operational_settings
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_operational_settings_member_write"
  on public.tenant_operational_settings
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

revoke all on table public.tenant_operational_settings from anon;
revoke all on table public.tenant_operational_settings from authenticated;
grant select, insert, update, delete on table public.tenant_operational_settings to service_role;
