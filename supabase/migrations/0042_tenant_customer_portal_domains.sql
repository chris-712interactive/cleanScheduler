-- =============================================================================
-- 0042_tenant_customer_portal_domains.sql
-- =============================================================================
-- Pro white-label customer portal: one custom hostname per tenant.

create table public.tenant_customer_portal_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hostname text not null,
  status text not null default 'pending' check (status in ('pending', 'active')),
  verification_token text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_customer_portal_domains_tenant_unique unique (tenant_id),
  constraint tenant_customer_portal_domains_hostname_unique unique (hostname)
);

create index tenant_customer_portal_domains_hostname_idx
  on public.tenant_customer_portal_domains (hostname);

create index tenant_customer_portal_domains_active_hostname_idx
  on public.tenant_customer_portal_domains (hostname)
  where status = 'active';

comment on table public.tenant_customer_portal_domains is
  'Custom hostname for Pro white-label customer portal (portal.client.com).';
comment on column public.tenant_customer_portal_domains.hostname is
  'Lowercase FQDN without protocol, e.g. portal.acmecleaning.com.';
comment on column public.tenant_customer_portal_domains.verification_token is
  'Value for TXT record at _cleanscheduler-verify.<hostname>.';

revoke all on table public.tenant_customer_portal_domains from anon;
revoke all on table public.tenant_customer_portal_domains from authenticated;
grant select, insert, update, delete on table public.tenant_customer_portal_domains to service_role;
