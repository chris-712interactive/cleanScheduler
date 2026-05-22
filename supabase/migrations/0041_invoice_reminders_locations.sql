-- Invoice reminder log, overdue notification toggles, and Pro multi-location branches.

create table public.tenant_invoice_reminder_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.tenant_invoices (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  reminder_kind text not null default 'overdue' check (reminder_kind in ('overdue', 'due_soon')),
  created_at timestamptz not null default now()
);

create unique index tenant_invoice_reminder_log_unique_idx
  on public.tenant_invoice_reminder_log (tenant_id, invoice_id, channel, reminder_kind);

create index tenant_invoice_reminder_log_tenant_created_idx
  on public.tenant_invoice_reminder_log (tenant_id, created_at desc);

alter table public.tenant_operational_settings
  add column if not exists email_notify_invoice_overdue boolean not null default true,
  add column if not exists sms_notify_invoice_overdue boolean not null default false;

comment on column public.tenant_operational_settings.email_notify_invoice_overdue is
  'Send overdue invoice reminder emails (Business+).';

comment on column public.tenant_operational_settings.sms_notify_invoice_overdue is
  'Send overdue invoice reminder SMS (Pro, paid subscription).';

create table public.tenant_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  code text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_locations_tenant_idx on public.tenant_locations (tenant_id);

create unique index tenant_locations_tenant_code_unique_idx
  on public.tenant_locations (tenant_id, lower(code))
  where code is not null;

create trigger tenant_locations_set_updated_at
before update on public.tenant_locations
for each row execute procedure public.set_updated_at();

alter table public.tenant_scheduled_visits
  add column if not exists location_id uuid null references public.tenant_locations (id) on delete set null;

alter table public.tenant_invoices
  add column if not exists location_id uuid null references public.tenant_locations (id) on delete set null;

create index tenant_scheduled_visits_location_idx
  on public.tenant_scheduled_visits (tenant_id, location_id)
  where location_id is not null;

comment on table public.tenant_locations is
  'Operational branches / territories (Pro multiLocationControls).';

alter table public.tenant_invoice_reminder_log enable row level security;
alter table public.tenant_locations enable row level security;

revoke all on table public.tenant_invoice_reminder_log from anon;
revoke all on table public.tenant_invoice_reminder_log from authenticated;
grant select, insert, update, delete on table public.tenant_invoice_reminder_log to service_role;

revoke all on table public.tenant_locations from anon;
revoke all on table public.tenant_locations from authenticated;
grant select, insert, update, delete on table public.tenant_locations to service_role;
