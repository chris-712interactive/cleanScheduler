-- Platform staff may read a tenant's customers and quotes only with a live
-- masquerade_sessions row for that tenant. The script rolls back. A missing
-- table, helper, or role is a failure.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/support_session_tenant_read.sql

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
  staff_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
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
  session_id uuid;
  slug_a text;
  slug_b text;
  customer_count integer;
  quote_count integer;
  updated_count integer;
  started_before timestamptz;
  started_after timestamptz;
BEGIN
  IF to_regclass('public.customers') IS NULL
     OR to_regclass('public.tenant_quotes') IS NULL
     OR to_regclass('public.masquerade_sessions') IS NULL
     OR to_regclass('public.masquerade_handoff_tokens') IS NULL
     OR to_regclass('public.tenant_quote_pipeline_stages') IS NULL
     OR to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR to_regprocedure('auth.jwt()') IS NULL
     OR to_regprocedure('public.has_live_support_session(uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION
      'support session RLS test requires customers, tenant_quotes, masquerade_sessions, masquerade_handoff_tokens, pipeline stages, auth.users, auth.uid(), auth.jwt(), has_live_support_session(uuid), and role authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'has_live_support_session'
      AND pg_get_function_identity_arguments(p.oid) = 'p_tenant uuid'
      AND p.prosecdef
      AND p.provolatile = 's'
      AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, array[]::text[])) cfg
        WHERE cfg = 'search_path=public'
      )
  ) THEN
    RAISE EXCEPTION 'has_live_support_session(uuid) must be stable security definer with search_path=public';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'masquerade_sessions'
      AND policyname = 'masquerade_sessions_platform_write'
  ) THEN
    RAISE EXCEPTION 'masquerade_sessions_platform_write is still present';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND qual LIKE '%has_live_support_session%'
  ) THEN
    RAISE EXCEPTION 'customers policies are not gated by has_live_support_session';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenants_admin_or_member_read'
      AND qual LIKE '%is_platform_admin%'
      AND qual NOT LIKE '%has_live_support_session%'
  ) THEN
    RAISE EXCEPTION 'tenant list policy must stay is_platform_admin() without a live session';
  END IF;

  IF has_table_privilege('authenticated', 'public.masquerade_sessions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.masquerade_sessions', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated can still insert or update masquerade_sessions';
  END IF;

  IF has_table_privilege('authenticated', 'public.masquerade_handoff_tokens', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated can insert masquerade handoff tokens';
  END IF;

  slug_a := 'rlssa' || substr(replace(staff_id::text, '-', ''), 1, 12);
  slug_b := 'rlssb' || substr(replace(member_id::text, '-', ''), 1, 12);

  PERFORM pg_temp.insert_auth_user(staff_id, 'rls-staff-' || staff_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(member_id, 'rls-member-' || member_id || '@example.test');

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_a, 'RLS support tenant A')
  RETURNING id INTO tenant_a;

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_b, 'RLS support tenant B')
  RETURNING id INTO tenant_b;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-support-a-' || tenant_a || '@example.test', 'RLS Support A')
  RETURNING id INTO identity_a;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-support-b-' || tenant_b || '@example.test', 'RLS Support B')
  RETURNING id INTO identity_b;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_a, identity_a, 'active')
  RETURNING id INTO customer_a;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_b, identity_b, 'active')
  RETURNING id INTO customer_b;

  SELECT id INTO stage_a
  FROM public.tenant_quote_pipeline_stages
  WHERE tenant_id = tenant_a AND system_status = 'draft'
  LIMIT 1;
  IF stage_a IS NULL THEN
    INSERT INTO public.tenant_quote_pipeline_stages (
      tenant_id, name, sort_order, is_system, system_status, on_enter_status
    )
    VALUES (tenant_a, 'Draft', 0, true, 'draft', 'draft')
    RETURNING id INTO stage_a;
  END IF;

  SELECT id INTO stage_b
  FROM public.tenant_quote_pipeline_stages
  WHERE tenant_id = tenant_b AND system_status = 'draft'
  LIMIT 1;
  IF stage_b IS NULL THEN
    INSERT INTO public.tenant_quote_pipeline_stages (
      tenant_id, name, sort_order, is_system, system_status, on_enter_status
    )
    VALUES (tenant_b, 'Draft', 0, true, 'draft', 'draft')
    RETURNING id INTO stage_b;
  END IF;

  INSERT INTO public.tenant_quotes (tenant_id, customer_id, title, pipeline_stage_id)
  VALUES (tenant_a, customer_a, 'rls-support-quote-a', stage_a)
  RETURNING id INTO quote_a;

  INSERT INTO public.tenant_quotes (tenant_id, customer_id, title, pipeline_stage_id)
  VALUES (tenant_b, customer_b, 'rls-support-quote-b', stage_b)
  RETURNING id INTO quote_b;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
  VALUES (tenant_a, member_id, 'owner', true);

  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT ON TABLE public.customers TO authenticated;
  GRANT SELECT ON TABLE public.tenant_quotes TO authenticated;

  PERFORM set_config('request.jwt.claim.sub', staff_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', staff_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'admin')
    )::text,
    true
  );
  PERFORM set_config(
    'request.jwt.claim',
    json_build_object(
      'sub', staff_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'admin')
    )::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'staff JWT was not recognized as platform admin';
  END IF;

  SELECT count(*) INTO customer_count FROM public.customers WHERE id IN (customer_a, customer_b);
  SELECT count(*) INTO quote_count FROM public.tenant_quotes WHERE id IN (quote_a, quote_b);
  IF customer_count <> 0 OR quote_count <> 0 THEN
    RAISE EXCEPTION 'staff with no session saw customers=% quotes=%', customer_count, quote_count;
  END IF;

  EXECUTE 'RESET ROLE';

  INSERT INTO public.masquerade_sessions (admin_user_id, target_tenant_id, started_at)
  VALUES (staff_id, tenant_a, now())
  RETURNING id INTO session_id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  SELECT count(*) INTO quote_count FROM public.tenant_quotes WHERE id = quote_a;
  IF customer_count <> 1 OR quote_count <> 1 THEN
    RAISE EXCEPTION 'live session should see tenant A customers=% quotes=%', customer_count, quote_count;
  END IF;
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_b;
  SELECT count(*) INTO quote_count FROM public.tenant_quotes WHERE id = quote_b;
  IF customer_count <> 0 OR quote_count <> 0 THEN
    RAISE EXCEPTION 'live session for A saw tenant B customers=% quotes=%', customer_count, quote_count;
  END IF;
  EXECUTE 'RESET ROLE';

  UPDATE public.masquerade_sessions SET ended_at = now() WHERE id = session_id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  SELECT count(*) INTO quote_count FROM public.tenant_quotes WHERE id = quote_a;
  IF customer_count <> 0 OR quote_count <> 0 THEN
    RAISE EXCEPTION 'ended session still saw customers=% quotes=%', customer_count, quote_count;
  END IF;
  EXECUTE 'RESET ROLE';

  UPDATE public.masquerade_sessions
  SET ended_at = NULL, started_at = now() - interval '1 hour 1 second'
  WHERE id = session_id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  IF customer_count <> 0 THEN
    RAISE EXCEPTION 'expired session still saw the customer';
  END IF;
  EXECUTE 'RESET ROLE';

  UPDATE public.masquerade_sessions
  SET started_at = now() + interval '61 seconds'
  WHERE id = session_id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  IF customer_count <> 0 THEN
    RAISE EXCEPTION 'future session still saw the customer';
  END IF;
  EXECUTE 'RESET ROLE';

  UPDATE public.masquerade_sessions
  SET started_at = now() + interval '30 seconds'
  WHERE id = session_id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  IF customer_count <> 1 THEN
    RAISE EXCEPTION 'session within 60s skew should see tenant A, saw %', customer_count;
  END IF;
  EXECUTE 'RESET ROLE';

  UPDATE public.masquerade_sessions
  SET started_at = now() - interval '1 hour'
  WHERE id = session_id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  IF customer_count <> 1 THEN
    RAISE EXCEPTION 'session at the exact one-hour mark should see tenant A, saw %', customer_count;
  END IF;

  BEGIN
    INSERT INTO public.masquerade_sessions (admin_user_id, target_tenant_id)
    VALUES (staff_id, tenant_a);
    RAISE EXCEPTION 'staff JWT inserted a masquerade session';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  EXECUTE 'RESET ROLE';
  SELECT started_at INTO started_before
  FROM public.masquerade_sessions
  WHERE id = session_id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    UPDATE public.masquerade_sessions
    SET started_at = now() + interval '30 days', ended_at = NULL
    WHERE id = session_id;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> 0 THEN
      RAISE EXCEPTION 'staff JWT updated a masquerade session (% rows)', updated_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  EXECUTE 'RESET ROLE';
  SELECT started_at INTO started_after
  FROM public.masquerade_sessions
  WHERE id = session_id;
  IF started_after IS DISTINCT FROM started_before THEN
    RAISE EXCEPTION 'staff JWT changed masquerade started_at';
  END IF;

  IF to_regclass('public.masquerade_sessions_one_open_per_staff') IS NULL THEN
    RAISE EXCEPTION 'masquerade_sessions_one_open_per_staff is missing';
  END IF;

  BEGIN
    INSERT INTO public.masquerade_sessions (admin_user_id, target_tenant_id, started_at)
    VALUES (staff_id, tenant_b, now());
    RAISE EXCEPTION 'a second open support session was inserted';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  UPDATE public.masquerade_sessions
  SET ended_at = now()
  WHERE admin_user_id = staff_id
    AND ended_at IS NULL;

  INSERT INTO public.masquerade_sessions (admin_user_id, target_tenant_id, started_at)
  VALUES (staff_id, tenant_b, now());

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  IF customer_count <> 0 THEN
    RAISE EXCEPTION 'closing the older session should hide tenant A, saw %', customer_count;
  END IF;
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_b;
  IF customer_count <> 1 THEN
    RAISE EXCEPTION 'the remaining open session should see tenant B, saw %', customer_count;
  END IF;
  EXECUTE 'RESET ROLE';

  UPDATE public.masquerade_sessions
  SET ended_at = now()
  WHERE admin_user_id = staff_id
    AND ended_at IS NULL;

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO customer_count
  FROM public.customers
  WHERE id IN (customer_a, customer_b);
  IF customer_count <> 0 THEN
    RAISE EXCEPTION 'ending every open session should hide both tenants, saw %', customer_count;
  END IF;
  EXECUTE 'RESET ROLE';

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
  PERFORM set_config(
    'request.jwt.claim',
    json_build_object(
      'sub', member_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'employee')
    )::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'workspace member was treated as platform admin';
  END IF;
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_a;
  SELECT count(*) INTO quote_count FROM public.tenant_quotes WHERE id = quote_a;
  IF customer_count <> 1 OR quote_count <> 1 THEN
    RAISE EXCEPTION 'member should see their own rows customers=% quotes=%', customer_count, quote_count;
  END IF;
  SELECT count(*) INTO customer_count FROM public.customers WHERE id = customer_b;
  SELECT count(*) INTO quote_count FROM public.tenant_quotes WHERE id = quote_b;
  IF customer_count <> 0 OR quote_count <> 0 THEN
    RAISE EXCEPTION 'member saw the other tenant customers=% quotes=%', customer_count, quote_count;
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Support session tenant read passed.';
END $$;

ROLLBACK;
