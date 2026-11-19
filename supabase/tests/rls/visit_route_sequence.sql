-- route_sequence stays behind the existing tenant member policies.
-- A member can update the column on their own visit and cannot read or
-- update another tenant's visit. The script rolls back. It does not skip.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/visit_route_sequence.sql

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
  tenant_a uuid;
  tenant_b uuid;
  identity_a uuid;
  identity_b uuid;
  customer_a uuid;
  customer_b uuid;
  visit_a uuid;
  visit_b uuid;
  own_count integer;
  cross_count integer;
  own_updated integer;
  cross_updated integer;
  saved_sequence integer;
  slug_a text;
  slug_b text;
BEGIN
  IF to_regclass('public.tenant_scheduled_visits') IS NULL
     OR to_regclass('public.tenant_memberships') IS NULL
     OR to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION
      'route_sequence RLS requires visits, memberships, auth.users, auth.uid(), and role authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_scheduled_visits'
      AND column_name = 'route_sequence'
  ) THEN
    RAISE EXCEPTION 'tenant_scheduled_visits.route_sequence is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tenant_scheduled_visits'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'tenant_scheduled_visits RLS is not enabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_scheduled_visits'
      AND policyname = 'tenant_scheduled_visits_member_read'
      AND qual LIKE '%has_tenant_membership%'
  ) THEN
    RAISE EXCEPTION 'visit read policy must keep has_tenant_membership';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_scheduled_visits'
      AND policyname = 'tenant_scheduled_visits_member_write'
      AND qual LIKE '%has_tenant_membership%'
      AND with_check LIKE '%has_tenant_membership%'
  ) THEN
    RAISE EXCEPTION 'visit write policy must keep has_tenant_membership';
  END IF;

  slug_a := 'rlsrt' || substr(replace(member_id::text, '-', ''), 1, 12);
  slug_b := 'rlsru' || substr(replace(other_id::text, '-', ''), 1, 12);

  PERFORM pg_temp.insert_auth_user(member_id, 'rls-route-' || member_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(other_id, 'rls-route-other-' || other_id || '@example.test');

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_a, 'RLS route tenant A')
  RETURNING id INTO tenant_a;

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_b, 'RLS route tenant B')
  RETURNING id INTO tenant_b;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-route-customer-a-' || tenant_a || '@example.test', 'RLS Route A')
  RETURNING id INTO identity_a;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-route-customer-b-' || tenant_b || '@example.test', 'RLS Route B')
  RETURNING id INTO identity_b;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_a, identity_a, 'active')
  RETURNING id INTO customer_a;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_b, identity_b, 'active')
  RETURNING id INTO customer_b;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
  VALUES
    (tenant_a, member_id, 'owner', true),
    (tenant_b, other_id, 'owner', true);

  INSERT INTO public.tenant_scheduled_visits (
    tenant_id, customer_id, title, starts_at, ends_at, route_sequence
  )
  VALUES (
    tenant_a, customer_a, 'rls-route-a', now(), now() + interval '1 hour', null
  )
  RETURNING id INTO visit_a;

  INSERT INTO public.tenant_scheduled_visits (
    tenant_id, customer_id, title, starts_at, ends_at, route_sequence
  )
  VALUES (
    tenant_b, customer_b, 'rls-route-b', now(), now() + interval '1 hour', 4
  )
  RETURNING id INTO visit_b;

  BEGIN
    UPDATE public.tenant_scheduled_visits
    SET route_sequence = 0
    WHERE id = visit_a;
    RAISE EXCEPTION 'route_sequence 0 should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT, UPDATE ON TABLE public.tenant_scheduled_visits TO authenticated;
  GRANT SELECT ON TABLE public.customers TO authenticated;

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
    FROM public.tenant_scheduled_visits
    WHERE id = visit_a;

    SELECT count(*) INTO cross_count
    FROM public.tenant_scheduled_visits
    WHERE id = visit_b OR tenant_id = tenant_b;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'member visit read raised 42501: %', SQLERRM;
  END;

  IF own_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'member should see their own visit, saw %', own_count;
  END IF;
  IF cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'member should not see the other tenant visit, saw %', cross_count;
  END IF;

  BEGIN
    UPDATE public.tenant_scheduled_visits
    SET route_sequence = 2
    WHERE id = visit_a;
    GET DIAGNOSTICS own_updated = ROW_COUNT;

    UPDATE public.tenant_scheduled_visits
    SET route_sequence = 9
    WHERE id = visit_b;
    GET DIAGNOSTICS cross_updated = ROW_COUNT;

    SELECT route_sequence INTO saved_sequence
    FROM public.tenant_scheduled_visits
    WHERE id = visit_a;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'member route_sequence update raised 42501: %', SQLERRM;
  END;

  IF own_updated IS DISTINCT FROM 1 OR saved_sequence IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'member should save route_sequence on their visit, updated % sequence %', own_updated, saved_sequence;
  END IF;
  IF cross_updated IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'member should not update the other tenant route_sequence, updated %', cross_updated;
  END IF;
END;
$$;

ROLLBACK;
