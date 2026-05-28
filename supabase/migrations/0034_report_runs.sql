-- Report runs cache + payment index for date-range reports.

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  report_slug text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
  result_json jsonb,
  row_count int,
  csv_storage_path text,
  pdf_storage_path text,
  expires_at timestamptz,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index report_runs_tenant_created_idx on public.report_runs (tenant_id, created_at desc);

create index report_runs_tenant_slug_params_idx on public.report_runs (tenant_id, report_slug);

create index tenant_invoice_payments_tenant_recorded_idx
  on public.tenant_invoice_payments (tenant_id, recorded_at desc);

alter table public.report_runs enable row level security;

create policy "report_runs_member_read"
  on public.report_runs
  for select
  to authenticated
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.report_runs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report_exports',
  'report_exports',
  false,
  10485760,
  array['text/csv', 'application/pdf']
)
on conflict (id) do nothing;
