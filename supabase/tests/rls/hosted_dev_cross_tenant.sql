-- Read-only cross-tenant RLS check for hosted dev.
-- The runner must already prove the connection is the dev Supabase project.
-- Required psql variables: user_a, user_b, tenant_a, tenant_b, marker_a, marker_b.

\set ON_ERROR_STOP on

SELECT (
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tenant_quotes'
      AND c.relrowsecurity
  )
  AND EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_quotes'
      AND cmd = 'SELECT'
      AND policyname = 'tenant_quotes_admin_or_tenant_member_read'
  )
) AS policy_ok;
\gset
\if :policy_ok
\else
-- \quit ignores a return code and exits 0. A raised error stops psql.
SELECT CAST('FAIL: tenant_quotes select policy is missing' AS integer);
\endif

BEGIN;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'user_a', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_a',
    'role', 'authenticated',
    'app_metadata', json_build_object('app_role', 'customer')
  )::text,
  true
);

SELECT (count(*) >= 1) AS own_ok
FROM public.tenant_quotes
WHERE tenant_id = :'tenant_a'::uuid
  AND title = :'marker_a';
\gset
\if :own_ok
\else
SELECT CAST('BLOCKED: viewer A cannot see its own fixture quote' AS integer);
\endif

SELECT (count(*) = 0) AS cross_ok
FROM public.tenant_quotes
WHERE tenant_id = :'tenant_b'::uuid
   OR title = :'marker_b';
\gset
\if :cross_ok
\else
SELECT CAST('FAIL: viewer A can read the other tenant' AS integer);
\endif

SELECT set_config('request.jwt.claim.sub', :'user_b', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_b',
    'role', 'authenticated',
    'app_metadata', json_build_object('app_role', 'customer')
  )::text,
  true
);

SELECT (count(*) >= 1) AS own_ok
FROM public.tenant_quotes
WHERE tenant_id = :'tenant_b'::uuid
  AND title = :'marker_b';
\gset
\if :own_ok
\else
SELECT CAST('BLOCKED: viewer B cannot see its own fixture quote' AS integer);
\endif

SELECT (count(*) = 0) AS cross_ok
FROM public.tenant_quotes
WHERE tenant_id = :'tenant_a'::uuid
   OR title = :'marker_a';
\gset
\if :cross_ok
\else
SELECT CAST('FAIL: viewer B can read the other tenant' AS integer);
\endif

ROLLBACK;
