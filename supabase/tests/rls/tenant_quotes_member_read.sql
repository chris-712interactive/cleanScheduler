-- Member quote reads under RLS (run with psql against a migrated database).
-- Proves an authenticated tenant member can read their own tenant_quotes row,
-- cannot read another tenant's row, and does not hit SQLSTATE 42501 when
-- authenticated has no SELECT grant on tenant_memberships.
-- The whole script rolls back. It does not keep fixture rows.
-- A missing table, auth.uid(), or authenticated role is a failure. Skipping
-- would let check:rls-smoke pass without reading a quote.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/tenant_quotes_member_read.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE FUNCTION pg_temp.insert_auth_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  col text;
  typ text;
  cols text[] := array[]::text[];
  vals text[] := array[]::text[];
BEGIN
  FOR col, typ IN
    SELECT a.attname, format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth'
      AND c.relname = 'users'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attnotnull
      AND NOT a.atthasdef
      AND a.attidentity = ''
      AND a.attgenerated = ''
  LOOP
    cols := array_append(cols, quote_ident(col));
    IF col = 'id' THEN
      vals := array_append(vals, quote_literal(p_id));
    ELSIF col = 'email' THEN
      vals := array_append(vals, quote_literal(p_email));
    ELSIF typ = 'uuid' THEN
      vals := array_append(vals, 'gen_random_uuid()');
    ELSIF typ = 'boolean' THEN
      vals := array_append(vals, 'false');
    ELSIF typ = 'jsonb' THEN
      vals := array_append(vals, quote_literal('{}') || '::jsonb');
    ELSIF typ LIKE 'timestamp%' THEN
      vals := array_append(vals, 'now()');
    ELSIF typ IN ('smallint', 'integer', 'bigint') THEN
      vals := array_append(vals, '0');
    ELSIF typ = 'text' OR typ LIKE 'character varying%' THEN
      vals := array_append(vals, quote_literal(''));
    ELSE
      RAISE EXCEPTION 'auth.users column % (%) has no test default', col, typ;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM unnest(cols) AS c(name) WHERE c.name = 'id') THEN
    cols := array_append(cols, 'id');
    vals := array_append(vals, quote_literal(p_id));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name = 'email'
  ) AND NOT EXISTS (
    SELECT 1 FROM unnest(cols) AS c(name) WHERE c.name = 'email'
  ) THEN
    cols := array_append(cols, 'email');
    vals := array_append(vals, quote_literal(p_email));
  END IF;

  EXECUTE format(
    'insert into auth.users (%s) values (%s)',
    array_to_string(cols, ', '),
    array_to_string(vals, ', ')
  );
END;
$$;

DO $$
DECLARE
  member_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  stranger_id uuid := gen_random_uuid();
  inactive_id uuid := gen_random_uuid();
  employee_id uuid := gen_random_uuid();
  tenant_a uuid;
  tenant_b uuid;
  identity_a uuid;
  identity_b uuid;
  customer_a uuid;
  customer_b uuid;
  stage_a uuid;
  stage_b uuid;
  quote_a uuid;
  quote_b uuid;
  opening_a uuid;
  opening_b uuid;
  own_count integer;
  cross_count integer;
  stranger_count integer;
  inactive_count integer;
  employee_hiring_count integer;
  slug_a text;
  slug_b text;
BEGIN
  IF to_regclass('public.tenant_quotes') IS NULL
     OR to_regclass('public.tenant_memberships') IS NULL
     OR to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION
      'tenant quote member read requires public.tenant_quotes, public.tenant_memberships, auth.users, auth.uid(), and role authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'has_tenant_membership'
      AND pg_get_function_identity_arguments(p.oid) = 'target_tenant_id uuid'
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'has_tenant_membership(uuid) is not security definer';
  END IF;

  slug_a := 'rlsqa' || substr(replace(member_id::text, '-', ''), 1, 12);
  slug_b := 'rlsqb' || substr(replace(other_id::text, '-', ''), 1, 12);

  PERFORM pg_temp.insert_auth_user(member_id, 'rls-member-' || member_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(other_id, 'rls-other-' || other_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(stranger_id, 'rls-stranger-' || stranger_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(inactive_id, 'rls-inactive-' || inactive_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(employee_id, 'rls-employee-' || employee_id || '@example.test');

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_a, 'RLS quote tenant A')
  RETURNING id INTO tenant_a;

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_b, 'RLS quote tenant B')
  RETURNING id INTO tenant_b;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-customer-a-' || tenant_a || '@example.test', 'RLS Customer A')
  RETURNING id INTO identity_a;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-customer-b-' || tenant_b || '@example.test', 'RLS Customer B')
  RETURNING id INTO identity_b;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_a, identity_a, 'active')
  RETURNING id INTO customer_a;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_b, identity_b, 'active')
  RETURNING id INTO customer_b;

  INSERT INTO public.tenant_quote_pipeline_stages (
    tenant_id, name, sort_order, is_system, system_status, on_enter_status
  )
  VALUES (tenant_a, 'Draft', 0, true, 'draft', 'draft')
  RETURNING id INTO stage_a;

  INSERT INTO public.tenant_quote_pipeline_stages (
    tenant_id, name, sort_order, is_system, system_status, on_enter_status
  )
  VALUES (tenant_b, 'Draft', 0, true, 'draft', 'draft')
  RETURNING id INTO stage_b;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
  VALUES
    (tenant_a, member_id, 'owner', true),
    (tenant_b, other_id, 'owner', true),
    (tenant_a, inactive_id, 'owner', false),
    (tenant_a, employee_id, 'employee', true);

  INSERT INTO public.tenant_quotes (tenant_id, customer_id, title, pipeline_stage_id)
  VALUES (tenant_a, customer_a, 'rls-member-quote-a', stage_a)
  RETURNING id INTO quote_a;

  INSERT INTO public.tenant_quotes (tenant_id, customer_id, title, pipeline_stage_id)
  VALUES (tenant_b, customer_b, 'rls-member-quote-b', stage_b)
  RETURNING id INTO quote_b;

  IF to_regclass('public.tenant_hiring_openings') IS NOT NULL THEN
    INSERT INTO public.tenant_hiring_openings (tenant_id, slug, title, kind)
    VALUES (tenant_a, 'field-crew', 'RLS hiring A', 'field')
    RETURNING id INTO opening_a;

    INSERT INTO public.tenant_hiring_openings (tenant_id, slug, title, kind)
    VALUES (tenant_b, 'field-crew', 'RLS hiring B', 'field')
    RETURNING id INTO opening_b;

    GRANT SELECT ON TABLE public.tenant_hiring_openings TO authenticated;
  END IF;

  REVOKE SELECT ON TABLE public.tenant_memberships FROM PUBLIC;
  REVOKE SELECT ON TABLE public.tenant_memberships FROM authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE SELECT ON TABLE public.tenant_memberships FROM anon;
  END IF;

  IF to_regclass('public.tenant_role_permissions') IS NOT NULL THEN
    REVOKE SELECT ON TABLE public.tenant_role_permissions FROM PUBLIC;
    REVOKE SELECT ON TABLE public.tenant_role_permissions FROM authenticated;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE SELECT ON TABLE public.tenant_role_permissions FROM anon;
    END IF;
  END IF;

  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT ON TABLE public.tenant_quotes TO authenticated;

  IF has_table_privilege('authenticated', 'public.tenant_memberships', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated still has SELECT on tenant_memberships; the quote read would not prove the helper';
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', member_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', member_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'employee')
    )::text,
    true
  );
  BEGIN
    SELECT count(*) INTO own_count
    FROM public.tenant_quotes
    WHERE id = quote_a;

    SELECT count(*) INTO cross_count
    FROM public.tenant_quotes
    WHERE id = quote_b OR tenant_id = tenant_b;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'member quote read raised 42501: %', SQLERRM;
  END;

  IF own_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'member should see their own quote, saw %', own_count;
  END IF;
  IF cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'member should not see the other tenant quote, saw %', cross_count;
  END IF;

  IF opening_a IS NOT NULL THEN
    BEGIN
      SELECT count(*) INTO own_count
      FROM public.tenant_hiring_openings
      WHERE id = opening_a;

      SELECT count(*) INTO cross_count
      FROM public.tenant_hiring_openings
      WHERE id = opening_b;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE EXCEPTION 'member hiring read raised 42501: %', SQLERRM;
    END;

    IF own_count IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'owner should see their own hiring opening, saw %', own_count;
    END IF;
    IF cross_count IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'member should not see the other tenant hiring opening, saw %', cross_count;
    END IF;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', stranger_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', stranger_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'employee')
    )::text,
    true
  );
  BEGIN
    SELECT count(*) INTO stranger_count
    FROM public.tenant_quotes
    WHERE id IN (quote_a, quote_b);
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'non-member quote read raised 42501: %', SQLERRM;
  END;
  IF stranger_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'non-member should see no fixture quotes, saw %', stranger_count;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', inactive_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', inactive_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'employee')
    )::text,
    true
  );
  BEGIN
    SELECT count(*) INTO inactive_count
    FROM public.tenant_quotes
    WHERE id = quote_a;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'inactive member quote read raised 42501: %', SQLERRM;
  END;
  IF inactive_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'inactive member should not see the tenant quote, saw %', inactive_count;
  END IF;

  IF opening_a IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', employee_id::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', employee_id::text,
        'role', 'authenticated',
        'app_metadata', json_build_object('app_role', 'employee')
      )::text,
      true
    );
    BEGIN
      SELECT count(*) INTO employee_hiring_count
      FROM public.tenant_hiring_openings
      WHERE id = opening_a;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE EXCEPTION 'employee hiring read raised 42501: %', SQLERRM;
    END;
    IF employee_hiring_count IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'field employee without hiring permission should not see the opening, saw %', employee_hiring_count;
    END IF;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', employee_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', employee_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'employee')
    )::text,
    true
  );
  BEGIN
    SELECT count(*) INTO own_count
    FROM public.tenant_quotes
    WHERE id = quote_a;

    SELECT count(*) INTO cross_count
    FROM public.tenant_quotes
    WHERE id = quote_b;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'employee quote read raised 42501: %', SQLERRM;
  END;
  IF own_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'active employee member should see their tenant quote, saw %', own_count;
  END IF;
  IF cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'employee member should not see the other tenant quote, saw %', cross_count;
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Tenant quote member read passed.';
END $$;

ROLLBACK;
