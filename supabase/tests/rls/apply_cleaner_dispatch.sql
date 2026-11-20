-- apply_cleaner_dispatch is service-role only.
-- A snapshot that no longer matches is rejected.
-- A visit from another tenant is not updated.
-- The script rolls back. It does not skip.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/apply_cleaner_dispatch.sql

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  tenant_a uuid;
  tenant_b uuid;
  identity_a uuid;
  identity_b uuid;
  customer_a uuid;
  customer_b uuid;
  visit_a uuid;
  visit_b uuid;
  stamp_a timestamptz;
  start_a timestamptz;
  end_a timestamptz;
  sequence_b integer;
  saved_sequence integer;
  saved_status text;
  anon_exec boolean;
  auth_exec boolean;
  service_exec boolean;
BEGIN
  IF to_regprocedure('public.apply_cleaner_dispatch(uuid, jsonb, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'apply_cleaner_dispatch is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'dispatch RLS requires anon, authenticated, and service_role';
  END IF;

  SELECT has_function_privilege('anon', 'public.apply_cleaner_dispatch(uuid, jsonb, jsonb)', 'execute')
    INTO anon_exec;
  SELECT has_function_privilege('authenticated', 'public.apply_cleaner_dispatch(uuid, jsonb, jsonb)', 'execute')
    INTO auth_exec;
  SELECT has_function_privilege('service_role', 'public.apply_cleaner_dispatch(uuid, jsonb, jsonb)', 'execute')
    INTO service_exec;

  IF anon_exec OR auth_exec OR NOT service_exec THEN
    RAISE EXCEPTION 'dispatch execute grants are wrong (anon %, authenticated %, service_role %)',
      anon_exec, auth_exec, service_exec;
  END IF;

  INSERT INTO public.tenants (slug, name)
  VALUES ('rlsdisp' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), 'RLS dispatch A')
  RETURNING id INTO tenant_a;

  INSERT INTO public.tenants (slug, name)
  VALUES ('rlsdisq' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), 'RLS dispatch B')
  RETURNING id INTO tenant_b;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-dispatch-a-' || tenant_a || '@example.test', 'RLS Dispatch A')
  RETURNING id INTO identity_a;

  INSERT INTO public.customer_identities (email, full_name)
  VALUES ('rls-dispatch-b-' || tenant_b || '@example.test', 'RLS Dispatch B')
  RETURNING id INTO identity_b;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_a, identity_a, 'active')
  RETURNING id INTO customer_a;

  INSERT INTO public.customers (tenant_id, customer_identity_id, status)
  VALUES (tenant_b, identity_b, 'active')
  RETURNING id INTO customer_b;

  INSERT INTO public.tenant_scheduled_visits (
    tenant_id, customer_id, title, starts_at, ends_at, route_sequence
  )
  VALUES (
    tenant_a, customer_a, 'rls-dispatch-a', now(), now() + interval '1 hour', null
  )
  RETURNING id, starts_at, ends_at, updated_at
  INTO visit_a, start_a, end_a, stamp_a;

  INSERT INTO public.tenant_scheduled_visits (
    tenant_id, customer_id, title, starts_at, ends_at, route_sequence
  )
  VALUES (
    tenant_b, customer_b, 'rls-dispatch-b', now(), now() + interval '1 hour', 4
  )
  RETURNING id INTO visit_b;

  BEGIN
    PERFORM public.apply_cleaner_dispatch(
      tenant_a,
      jsonb_build_array(
        jsonb_build_object(
          'id', visit_a,
          'startsAt', start_a,
          'endsAt', end_a,
          'status', 'scheduled',
          'checkedInAt', null,
          'routeSequence', null,
          'updatedAt', stamp_a,
          'assigneeIds', jsonb_build_array()
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', visit_b,
          'assigneeIds', jsonb_build_array(),
          'routeSequence', 1,
          'changeAssignees', false
        )
      )
    );
    RAISE EXCEPTION 'other tenant visit should be rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%tenant_mismatch%' THEN
        RAISE;
      END IF;
  END;

  SELECT route_sequence INTO sequence_b
  FROM public.tenant_scheduled_visits
  WHERE id = visit_b;
  IF sequence_b IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'other tenant route_sequence changed to %', sequence_b;
  END IF;

  PERFORM public.apply_cleaner_dispatch(
    tenant_a,
    jsonb_build_array(
      jsonb_build_object(
        'id', visit_a,
        'startsAt', start_a,
        'endsAt', end_a,
        'status', 'scheduled',
        'checkedInAt', null,
        'routeSequence', null,
        'updatedAt', stamp_a,
        'assigneeIds', jsonb_build_array()
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', visit_a,
        'assigneeIds', jsonb_build_array(),
        'routeSequence', 2,
        'changeAssignees', false
      )
    )
  );

  SELECT route_sequence, staffing_status::text
    INTO saved_sequence, saved_status
  FROM public.tenant_scheduled_visits
  WHERE id = visit_a;

  IF saved_sequence IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'dispatch should save route_sequence 2, saw %', saved_sequence;
  END IF;

  BEGIN
    PERFORM public.apply_cleaner_dispatch(
      tenant_a,
      jsonb_build_array(
        jsonb_build_object(
          'id', visit_a,
          'startsAt', start_a,
          'endsAt', end_a,
          'status', 'scheduled',
          'checkedInAt', null,
          'routeSequence', null,
          'updatedAt', stamp_a,
          'assigneeIds', jsonb_build_array()
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', visit_a,
          'assigneeIds', jsonb_build_array(),
          'routeSequence', 3,
          'changeAssignees', false
        )
      )
    );
    RAISE EXCEPTION 'stale snapshot should be rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%stale_dispatch%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.apply_cleaner_dispatch(
      tenant_a,
      jsonb_build_array(
        jsonb_build_object(
          'id', visit_a,
          'startsAt', start_a,
          'endsAt', end_a,
          'status', 'scheduled',
          'checkedInAt', null,
          'routeSequence', 2,
          'updatedAt', (SELECT updated_at FROM public.tenant_scheduled_visits WHERE id = visit_a),
          'assigneeIds', jsonb_build_array()
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', visit_a,
          'assigneeIds', jsonb_build_array(gen_random_uuid()),
          'routeSequence', 1,
          'changeAssignees', true
        )
      )
    );
    RAISE EXCEPTION 'unknown cleaner should be rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%cleaner_not_in_tenant%' THEN
        RAISE;
      END IF;
  END;

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.apply_cleaner_dispatch(tenant_a, '[]'::jsonb, '[]'::jsonb);
    RAISE EXCEPTION 'authenticated should not execute dispatch';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
