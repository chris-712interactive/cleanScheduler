-- Pro routing tables are tenant scoped.
-- An owner reads and writes their places and cannot see another tenant.
-- A field employee reads only their own base and drive row, not a coworker's home base.
-- Authenticated cannot write drive rows. Anon has no access.
-- The script rolls back.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/pro_routing_extras.sql

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
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email'
  ) AND NOT EXISTS (SELECT 1 FROM unnest(cols) AS c(name) WHERE c.name = 'email') THEN
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
  owner_id uuid := gen_random_uuid();
  employee_id uuid := gen_random_uuid();
  coworker_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  tenant_a uuid;
  tenant_b uuid;
  place_a uuid;
  own_count integer;
  cross_count integer;
  inserted integer;
  saved_start text;
  saved_end text;
  saved_start_place uuid;
  saved_end_place uuid;
BEGIN
  IF to_regclass('public.tenant_route_locations') IS NULL
     OR to_regclass('public.tenant_cleaner_route_bases') IS NULL
     OR to_regclass('public.tenant_applied_route_days') IS NULL
     OR to_regprocedure('public.can_manage_route_office(uuid)') IS NULL
     OR to_regprocedure('public.release_route_location_bases()') IS NULL THEN
    RAISE EXCEPTION 'pro routing tables are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tenant_route_locations' AND c.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tenant_cleaner_route_bases' AND c.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tenant_applied_route_days' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'pro routing RLS is not enabled';
  END IF;

  IF has_table_privilege('anon', 'public.tenant_route_locations', 'select')
     OR has_table_privilege('anon', 'public.tenant_cleaner_route_bases', 'select')
     OR has_table_privilege('anon', 'public.tenant_applied_route_days', 'select') THEN
    RAISE EXCEPTION 'anon can read pro routing tables';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.tenant_route_locations', 'select')
     OR has_table_privilege('authenticated', 'public.tenant_applied_route_days', 'insert') THEN
    RAISE EXCEPTION 'authenticated grants on pro routing tables are wrong';
  END IF;

  PERFORM pg_temp.insert_auth_user(owner_id, 'rls-route-owner-' || owner_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(employee_id, 'rls-route-employee-' || employee_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(coworker_id, 'rls-route-coworker-' || coworker_id || '@example.test');
  PERFORM pg_temp.insert_auth_user(other_id, 'rls-route-other-' || other_id || '@example.test');

  INSERT INTO public.tenants (slug, name)
  VALUES ('rlspro' || substr(replace(owner_id::text, '-', ''), 1, 12), 'RLS pro A')
  RETURNING id INTO tenant_a;

  INSERT INTO public.tenants (slug, name)
  VALUES ('rlsprb' || substr(replace(other_id::text, '-', ''), 1, 12), 'RLS pro B')
  RETURNING id INTO tenant_b;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
  VALUES
    (tenant_a, owner_id, 'owner', true),
    (tenant_a, employee_id, 'employee', true),
    (tenant_a, coworker_id, 'employee', true),
    (tenant_b, other_id, 'owner', true);

  INSERT INTO public.tenant_route_locations (tenant_id, label, address_line1, latitude, longitude)
  VALUES (tenant_a, 'North barn', '1 Barn Road', 35.7, -82.5)
  RETURNING id INTO place_a;

  INSERT INTO public.tenant_route_locations (tenant_id, label, address_line1)
  VALUES (tenant_b, 'Other office', '9 Other Road');

  INSERT INTO public.tenant_cleaner_route_bases (tenant_id, user_id, start_kind, end_kind)
  VALUES
    (tenant_a, employee_id, 'home', 'none'),
    (tenant_a, coworker_id, 'home', 'none');

  INSERT INTO public.tenant_applied_route_days (
    tenant_id, service_date, user_id, estimate_kind, miles, drive_seconds, stop_count, day_fingerprint
  ) VALUES
    (tenant_a, current_date, employee_id, 'straight-line', 4.2, null, 2, 'a'),
    (tenant_a, current_date, coworker_id, 'drive', 3.0, 600, 1, 'a'),
    (tenant_b, current_date, other_id, 'straight-line', 9.0, null, 1, 'b');

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_id::text, 'role', 'authenticated')::text,
    true
  );

  SELECT count(*) INTO own_count FROM public.tenant_route_locations WHERE id = place_a;
  SELECT count(*) INTO cross_count FROM public.tenant_route_locations WHERE tenant_id = tenant_b;
  IF own_count IS DISTINCT FROM 1 OR cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'owner location read own % other %', own_count, cross_count;
  END IF;

  SELECT count(*) INTO cross_count FROM public.tenant_applied_route_days WHERE tenant_id = tenant_b;
  IF cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'owner saw another tenant drive row';
  END IF;

  SELECT count(*) INTO own_count FROM public.tenant_applied_route_days WHERE tenant_id = tenant_a;
  IF own_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'owner should see both drive rows, saw %', own_count;
  END IF;

  UPDATE public.tenant_cleaner_route_bases
  SET
    start_kind = 'location',
    start_location_id = place_a,
    end_kind = 'location',
    end_location_id = place_a
  WHERE tenant_id = tenant_a
    AND user_id = employee_id;

  DELETE FROM public.tenant_route_locations WHERE id = place_a;

  SELECT start_kind, end_kind, start_location_id, end_location_id
    INTO saved_start, saved_end, saved_start_place, saved_end_place
  FROM public.tenant_cleaner_route_bases
  WHERE tenant_id = tenant_a
    AND user_id = employee_id;

  IF saved_start IS DISTINCT FROM 'office'
     OR saved_end IS DISTINCT FROM 'none'
     OR saved_start_place IS NOT NULL
     OR saved_end_place IS NOT NULL THEN
    RAISE EXCEPTION 'deleting a place should return the base to the office, saw % / %',
      saved_start, saved_end;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', employee_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', employee_id::text, 'role', 'authenticated')::text,
    true
  );

  SELECT count(*) INTO own_count
  FROM public.tenant_cleaner_route_bases
  WHERE user_id = employee_id;
  SELECT count(*) INTO cross_count
  FROM public.tenant_cleaner_route_bases
  WHERE user_id = coworker_id OR tenant_id = tenant_b;
  IF own_count IS DISTINCT FROM 1 OR cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'employee base read own % other %', own_count, cross_count;
  END IF;

  SELECT count(*) INTO own_count FROM public.tenant_route_locations;
  IF own_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'field employee should not read start places, saw %', own_count;
  END IF;

  SELECT count(*) INTO cross_count
  FROM public.tenant_applied_route_days
  WHERE user_id <> employee_id OR tenant_id = tenant_b;
  IF cross_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'field employee saw another drive row';
  END IF;

  BEGIN
    INSERT INTO public.tenant_applied_route_days (
      tenant_id, service_date, user_id, estimate_kind, miles, drive_seconds, stop_count, day_fingerprint
    ) VALUES (tenant_a, current_date, employee_id, 'straight-line', 1, null, 1, 'nope');
    RAISE EXCEPTION 'field employee inserted a drive row';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_id::text, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    INSERT INTO public.tenant_route_locations (tenant_id, label, address_line1)
    VALUES (tenant_b, 'Stolen', '1 Stolen Road');
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'owner of A inserted a place on B';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
