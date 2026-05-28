-- Tenant isolation RLS smoke checks (run locally/CI with psql against a seeded database).
-- Example:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/tenant_isolation.sql

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE NOTICE 'Skipping tenant isolation checks — public.tenants not present.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_invoices'
      AND policyname = 'tenant_invoices_member_read'
  ) THEN
    RAISE EXCEPTION 'Expected RLS policy tenant_invoices_member_read is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Expected SELECT policy on public.customers is missing';
  END IF;

  RAISE NOTICE 'Tenant isolation RLS fixtures passed.';
END $$;
