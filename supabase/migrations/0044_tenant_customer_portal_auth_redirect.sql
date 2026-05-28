-- =============================================================================
-- 0044_tenant_customer_portal_auth_redirect.sql
-- =============================================================================
-- Track Supabase Auth redirect URL registration for white-label OAuth.

alter table public.tenant_customer_portal_domains
  add column if not exists auth_redirect_registered_at timestamptz,
  add column if not exists auth_redirect_last_error text;

comment on column public.tenant_customer_portal_domains.auth_redirect_registered_at is
  'When the hostname auth callback URL was added to Supabase uri_allow_list.';
comment on column public.tenant_customer_portal_domains.auth_redirect_last_error is
  'Most recent Supabase Management API error while syncing auth redirect URLs.';
