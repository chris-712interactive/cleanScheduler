-- Day map rows under RLS (run with psql against a migrated database).
-- An authenticated member can read their own visit and its service-location
-- point. They cannot read the other tenant's visit, address, or coordinates.
-- The whole script rolls back. It does not keep fixture rows.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/day_map_visit_read.sql

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
  tenant_a uuid;
  tenant_b uuid;
  identity_a uuid;
  identity_b uuid;
  customer_a uuid;
  customer_b uuid;
  property_a uuid;
  property_b uuid;
  visit_a uuid;
  visit_b uuid;
  own_count integer;
  cross_count integer;
  slug_a text;
  slug_b text;
BEGIN
  IF to_regclass('public.tenant_scheduled_visits') IS NULL
     OR to_regclass('public.tenant_customer_properties') IS NULL
     OR to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION
      'day map visit read requires visits, properties, auth.users, auth.uid(), and role authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_customer_properties'
      AND column_name = 'latitude'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_customer_properties'
      AND column_name = 'geocode_reason'
  ) THEN
    RAISE EXCEPTION 'day map visit read requires property latitude and geocode_reason';
  END IF;

  slug_a := 'rlsdma' || substr(replace(member_id::text, '-', ''), 1, 12);
  slug_b := 'rlsdmb' || substr(replace(member_id::text, '-', ''), 13, 12);

  PERFORM pg_temp.insert_auth_user(member_id, 'rls-day-map-' || member_id || '@example.test');

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_a, 'RLS day map tenant A')
  RETURNING id INTO tenant_a;

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_b, 'RLS day map tenant B')
  RETURNING id INTO tenant_b;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-day-map-a-' || tenant_a || '@example.test', 'RLS Map Customer A')
  RETURNING id INTO identity_a;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-day-map-b-' || tenant_b || '@example.test', 'RLS Map Customer B')
  RETURNING id INTO identity_b;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_a, identity_a, 'active')
  RETURNING id INTO customer_a;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_b, identity_b, 'active')
  RETURNING id INTO customer_b;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
  VALUES (tenant_a, member_id, 'owner', true);

  INSERT INTO public.tenant_customer_properties (
    tenant_id, customer_id, property_kind, address_line1, city, state, postal_code,
    latitude, longitude, geocode_reason, is_primary
  )
  VALUES (
    tenant_a, customer_a, 'residential', '1 RLS Map Street', 'Asheville', 'NC', '28801',
    35.5951, -82.5515, null, true
  )
  RETURNING id INTO property_a;

  INSERT INTO public.tenant_customer_properties (
    tenant_id, customer_id, property_kind, address_line1, city, state, postal_code,
    latitude, longitude, geocode_reason, is_primary
  )
  VALUES (
    tenant_b, customer_b, 'commercial', '500 RLS Other Park', 'Charlotte', 'NC', '28202',
    35.2271, -80.8431, null, true
  )
  RETURNING id INTO property_b;

  INSERT INTO public.tenant_scheduled_visits (
    tenant_id, customer_id, property_id, title, starts_at, ends_at, status
  )
  VALUES (
    tenant_a, customer_a, property_a, 'RLS map visit A',
    timestamptz '2026-06-01 14:00:00+00', timestamptz '2026-06-01 15:00:00+00', 'scheduled'
  )
  RETURNING id INTO visit_a;

  INSERT INTO public.tenant_scheduled_visits (
    tenant_id, customer_id, property_id, title, starts_at, ends_at, status
  )
  VALUES (
    tenant_b, customer_b, property_b, 'RLS map visit B',
    timestamptz '2026-06-01 16:00:00+00', timestamptz '2026-06-01 17:00:00+00', 'scheduled'
  )
  RETURNING id INTO visit_b;

  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT ON TABLE public.tenant_scheduled_visits TO authenticated;
  GRANT SELECT ON TABLE public.tenant_customer_properties TO authenticated;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', member_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', member_id::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('app_role', 'employee', 'tenant_role', 'owner')
    )::text,
    true
  );

  BEGIN
    SELECT count(*) INTO own_count
    FROM public.tenant_scheduled_visits v
    JOIN public.tenant_customer_properties p ON p.id = v.property_id
    WHERE v.id = visit_a
      AND p.address_line1 = '1 RLS Map Street'
      AND p.latitude = 35.5951
      AND p.longitude = -82.5515;

    SELECT count(*) INTO cross_count
    FROM public.tenant_scheduled_visits v
    FULL JOIN public.tenant_customer_properties p ON p.id = v.property_id
    WHERE v.id = visit_b
       OR v.tenant_id = tenant_b
       OR p.id = property_b
       OR p.tenant_id = tenant_b
       OR p.address_line1 = '500 RLS Other Park'
       OR p.latitude = 35.2271;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'day map member read raised 42501: %', SQLERRM;
  END;

  IF own_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'member should see their own mapped visit, saw %', own_count;
  END IF;
  IF cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'member should not see the other tenant map rows, saw %', cross_count;
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Day map visit read passed.';
END $$;

ROLLBACK;
