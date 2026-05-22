-- =============================================================================
-- 0043_tenant_customer_portal_domains_vercel.sql
-- =============================================================================
-- Store Vercel domain verification challenges; legacy TXT token optional.

alter table public.tenant_customer_portal_domains
  alter column verification_token drop not null;

alter table public.tenant_customer_portal_domains
  add column if not exists vercel_verification jsonb,
  add column if not exists vercel_last_error text;

comment on column public.tenant_customer_portal_domains.vercel_verification is
  'Latest DNS verification records returned by Vercel when the hostname was registered.';
comment on column public.tenant_customer_portal_domains.vercel_last_error is
  'Most recent Vercel API error while registering or verifying the hostname.';
