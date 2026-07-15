-- =============================================================================
-- 0085_starter_value_pack.sql
-- Customer review URL, on-my-way + review-request email toggles, dedupe log.
-- =============================================================================

alter table public.tenants
  add column if not exists customer_review_url text null;

comment on column public.tenants.customer_review_url is
  'Public review link (Google, Yelp, etc.) used for post-visit review-request emails.';

alter table public.tenant_operational_settings
  add column if not exists email_notify_on_my_way boolean not null default false,
  add column if not exists email_notify_review_request boolean not null default false;

comment on column public.tenant_operational_settings.email_notify_on_my_way is
  'When true, email the customer when crew checks in (on-my-way).';

comment on column public.tenant_operational_settings.email_notify_review_request is
  'When true, email a review request after a completed service visit (requires tenants.customer_review_url).';

create type public.visit_customer_email_kind as enum ('on_my_way', 'review_request');

create table if not exists public.tenant_visit_customer_email_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  visit_id uuid not null references public.tenant_scheduled_visits (id) on delete cascade,
  kind public.visit_customer_email_kind not null,
  created_at timestamptz not null default now(),
  constraint tenant_visit_customer_email_log_unique unique (tenant_id, visit_id, kind)
);

create index if not exists tenant_visit_customer_email_log_tenant_created_idx
  on public.tenant_visit_customer_email_log (tenant_id, created_at desc);

comment on table public.tenant_visit_customer_email_log is
  'Dedupes transactional customer emails tied to a visit (on-my-way, review request).';

alter table public.tenant_visit_customer_email_log enable row level security;

revoke all on table public.tenant_visit_customer_email_log from anon, authenticated;
grant select, insert, update, delete on table public.tenant_visit_customer_email_log to service_role;
