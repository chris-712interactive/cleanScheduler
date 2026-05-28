-- Tenant isolation RLS smoke checks (run locally/CI with psql against a seeded database).
-- Example:
--   npm run check:rls-smoke
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/tenant_isolation.sql

\set ON_ERROR_STOP on

DO $$
DECLARE
  missing text[];
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE NOTICE 'Skipping tenant isolation checks — public.tenants not present.';
    RETURN;
  END IF;

  missing := ARRAY[]::text[];

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_invoices'
      AND policyname = 'tenant_invoices_member_read'
  ) THEN
    missing := array_append(missing, 'tenant_invoices_member_read');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND cmd = 'SELECT'
  ) THEN
    missing := array_append(missing, 'customers SELECT policy');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_quotes' AND cmd = 'SELECT'
  ) THEN
    missing := array_append(missing, 'tenant_quotes SELECT policy');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_scheduled_visits' AND cmd = 'SELECT'
  ) THEN
    missing := array_append(missing, 'tenant_scheduled_visits SELECT policy');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bank_links' AND cmd = 'SELECT'
  ) THEN
    missing := array_append(missing, 'bank_links SELECT policy');
  END IF;

  IF to_regclass('public.tenant_invoices') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'tenant_invoices' AND c.relrowsecurity
    ) THEN
      missing := array_append(missing, 'tenant_invoices RLS not enabled');
    END IF;
  END IF;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant isolation RLS smoke failed — missing: %', array_to_string(missing, ', ');
  END IF;

  RAISE NOTICE 'Tenant isolation RLS fixtures passed.';
END $$;
