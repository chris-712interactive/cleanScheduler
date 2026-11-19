-- Text pack ledger RLS. A member can read their own balance and cannot read
-- another tenant. Authenticated cannot insert, update, or consume credits.
-- The script rolls back.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/text_pack_ledger.sql

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
  own_segments integer;
  cross_segments integer;
  slug_a text;
  slug_b text;
  inserted_id uuid;
  updated_count integer;
BEGIN
  IF to_regclass('public.tenant_text_pack_ledger') IS NULL
     OR to_regclass('public.tenant_memberships') IS NULL
     OR to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION
      'text pack ledger RLS requires the ledger, memberships, auth.users, auth.uid(), and role authenticated';
  END IF;

  slug_a := 'rlstpa' || substr(replace(member_id::text, '-', ''), 1, 12);
  slug_b := 'rlstpb' || substr(replace(member_id::text, '-', ''), 13, 12);

  PERFORM pg_temp.insert_auth_user(member_id, 'rls-text-pack-' || member_id || '@example.test');

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_a, 'RLS text pack tenant A')
  RETURNING id INTO tenant_a;

  INSERT INTO public.tenants (slug, name)
  VALUES (slug_b, 'RLS text pack tenant B')
  RETURNING id INTO tenant_b;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
  VALUES (tenant_a, member_id, 'owner', true);

  INSERT INTO public.tenant_text_pack_ledger (
    tenant_id, segments, kind, stripe_checkout_session_id, pack_key, amount_cents
  )
  VALUES (tenant_a, 1000, 'purchase', 'cs_rls_a_' || tenant_a::text, 'pack_1000', 1500);

  INSERT INTO public.tenant_text_pack_ledger (
    tenant_id, segments, kind, stripe_checkout_session_id, pack_key, amount_cents
  )
  VALUES (tenant_b, 2500, 'purchase', 'cs_rls_b_' || tenant_b::text, 'pack_2500', 3500);

  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT ON TABLE public.tenant_text_pack_ledger TO authenticated;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', member_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
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
    SELECT coalesce(sum(segments), 0) INTO own_segments
    FROM public.tenant_text_pack_ledger
    WHERE tenant_id = tenant_a;

    SELECT coalesce(sum(segments), 0) INTO cross_segments
    FROM public.tenant_text_pack_ledger
    WHERE tenant_id = tenant_b;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'text pack member read raised 42501: %', SQLERRM;
  END;

  IF own_segments IS DISTINCT FROM 1000 THEN
    RAISE EXCEPTION 'member should read their own text pack balance, saw %', own_segments;
  END IF;
  IF cross_segments IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'member should not read the other tenant text pack balance, saw %', cross_segments;
  END IF;

  BEGIN
    INSERT INTO public.tenant_text_pack_ledger (
      tenant_id, segments, kind, stripe_checkout_session_id, pack_key, amount_cents
    )
    VALUES (tenant_a, 1000, 'purchase', 'cs_rls_member_' || tenant_a::text, 'pack_1000', 1500)
    RETURNING id INTO inserted_id;
    RAISE EXCEPTION 'authenticated insert should be rejected, inserted %', inserted_id;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    UPDATE public.tenant_text_pack_ledger
    SET segments = 1
    WHERE tenant_id = tenant_a;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> 0 THEN
      RAISE EXCEPTION 'authenticated update should not change credits, updated %', updated_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.consume_text_pack_segments(tenant_a, 1);
    RAISE EXCEPTION 'authenticated should not execute consume_text_pack_segments';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Text pack ledger RLS passed.';
END $$;

ROLLBACK;
