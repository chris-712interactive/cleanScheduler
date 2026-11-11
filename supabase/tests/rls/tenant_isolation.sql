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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_hiring_applications'
      AND policyname = 'tenant_hiring_applications_member_read'
      AND qual LIKE '%can_read_hiring_desk%'
  ) THEN
    missing := array_append(missing, 'tenant_hiring_applications_member_read');
  END IF;

  IF to_regclass('public.tenant_hiring_applications') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'tenant_hiring_applications' AND c.relrowsecurity
    ) THEN
      missing := array_append(missing, 'tenant_hiring_applications RLS not enabled');
    END IF;
  END IF;

  IF to_regclass('public.tenant_operational_settings') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_operational_settings'
        AND column_name = 'service_segment'
    ) THEN
      missing := array_append(missing, 'tenant_operational_settings.service_segment');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'tenant_operational_settings' AND c.relrowsecurity
    ) THEN
      missing := array_append(missing, 'tenant_operational_settings RLS not enabled');
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'tenant_operational_settings'
        AND grantee IN ('anon', 'authenticated')
        AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) THEN
      missing := array_append(missing, 'tenant_operational_settings granted to anon or authenticated');
    END IF;
  END IF;

  IF to_regclass('public.tenant_quote_line_items') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_quote_line_items'
        AND column_name = 'sqft_rate_cents'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_quote_line_items'
        AND column_name = 'billable_sqft'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_quote_line_items'
        AND column_name = 'bid_visits'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_quote_line_items'
        AND column_name = 'bid_period'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_quote_line_items'
        AND column_name = 'production_sqft_per_hour'
    ) THEN
      missing := array_append(missing, 'tenant_quote_line_items square-foot bid columns');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'tenant_quote_line_items' AND c.relrowsecurity
    ) THEN
      missing := array_append(missing, 'tenant_quote_line_items RLS not enabled');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tenant_quote_line_items'
        AND cmd = 'SELECT'
    ) THEN
      missing := array_append(missing, 'tenant_quote_line_items SELECT policy');
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'tenant_quote_line_items'
        AND grantee IN ('anon', 'authenticated')
        AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) THEN
      missing := array_append(missing, 'tenant_quote_line_items granted to anon or authenticated');
    END IF;
  END IF;

  IF to_regclass('public.user_profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')
        AND privilege_type = 'UPDATE'
    ) THEN
      missing := array_append(missing, 'user_profiles table UPDATE granted to anon, authenticated, or public');
    END IF;

    IF has_column_privilege('authenticated', 'public.user_profiles', 'app_role', 'UPDATE') THEN
      missing := array_append(missing, 'authenticated can update user_profiles.app_role');
    END IF;

    IF NOT has_column_privilege('authenticated', 'public.user_profiles', 'display_name', 'UPDATE') THEN
      missing := array_append(missing, 'authenticated cannot update user_profiles.display_name');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'user_profiles_guard_privileged_columns'
        AND tgrelid = 'public.user_profiles'::regclass
        AND NOT tgisinternal
    ) THEN
      missing := array_append(missing, 'user_profiles_guard_privileged_columns trigger');
    END IF;
  END IF;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant isolation RLS smoke failed — missing: %', array_to_string(missing, ', ');
  END IF;

  RAISE NOTICE 'Tenant isolation RLS fixtures passed.';
END $$;
