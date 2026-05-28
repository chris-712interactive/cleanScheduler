-- =============================================================================
-- 0003_service_role_grants.sql
-- =============================================================================
-- Ensure service_role can run server-side onboarding flows through PostgREST.

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.tenants to service_role;
grant select, insert, update, delete on table public.tenant_memberships to service_role;
grant select, insert, update, delete on table public.user_profiles to service_role;
grant select, insert, update, delete on table public.tenant_billing_accounts to service_role;
