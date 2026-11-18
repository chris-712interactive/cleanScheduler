# QA brief

Read this before testing a pull request. Name env vars and where they are configured. Do not paste secret values, real emails, tenant ids, or slugs into comments, logs, or this file.

## Suites

**Vitest.** `npm run test` ([`vitest.config.ts`](../vitest.config.ts), `**/*.test.ts`). Node is [`.nvmrc`](../.nvmrc). No secrets. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs this with typecheck, Prettier, migration checks, ESLint, and Stylelint. CI does not run the production build or Playwright.

**Playwright smoke.** `npm run test:e2e` ([`playwright.smoke.config.ts`](../playwright.smoke.config.ts), [`tests/smoke`](../tests/smoke)). `PLAYWRIGHT_BASE_URL` defaults to `http://127.0.0.1:3000`. When `CI` is set, that config starts `npm run start`, so build first. Locally, start the app yourself ([`README.md`](../README.md)).

**RLS.** `npm run check:rls-smoke` ([`scripts/check-rls-smoke.mjs`](../scripts/check-rls-smoke.mjs)) needs `psql` and `DATABASE_URL` for a local database. It runs the SQL paths named in that script, under [`supabase/tests/rls/`](../supabase/tests/rls/). If `DATABASE_URL` is unset it exits 0 and prints that it skipped. That exit is not a pass of the SQL. [`hosted_dev_cross_tenant.sql`](../supabase/tests/rls/hosted_dev_cross_tenant.sql) runs only inside the isolated hosted-dev job.

**Build.** `npm run build` succeeds from a verbatim copy of [`.env.example`](../.env.example), which sets `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Blank `NEXT_PUBLIC_SENTRY_DSN` and `RESEND_FROM_EMAIL` count as unset. Whitespace-only `RESEND_FROM_EMAIL` is unset too. Any other value must be exactly `name@domain` or `Display Name <name@domain>` ([`docs/agents/next-16-4-5-security.md`](agents/next-16-4-5-security.md)).

## Hosted dev and local

Hosted dev is `https://dev.cleanscheduler.com`. Read-only smoke is `npm run test:hosted-dev`. Authenticated reads and cross-tenant RLS are `HOSTED_DEV_ISOLATED=1 npm run test:hosted-dev:isolated`. Scope, blocked rows, env var names, and where the dedicated QA tenants are defined: [`docs/ops/hosted-dev-tests.md`](ops/hosted-dev-tests.md). Those names are secrets on the `hosted-dev-isolated` GitHub environment, not repository secrets. The suite reads them in [`tests/hosted-dev/isolated.spec.ts`](../tests/hosted-dev/isolated.spec.ts). Do not create accounts. `psql` child env: [`docs/agents/hosted-dev-psql-env.md`](agents/hosted-dev-psql-env.md). Outbound suppression: [`docs/ops/outbound-suppression.md`](ops/outbound-suppression.md).

[`.github/workflows/hosted-dev.yml`](../.github/workflows/hosted-dev.yml) is dispatched by the owner from `main`. Agents do not dispatch it, set `HOSTED_DEV_ISOLATED`, or add `dev` to that environment's branch policy.

## Hard rules

Production is `https://cleanscheduler.com` and the production Supabase project. Leave both untouched, including any production connection string. The deny variable is `HOSTED_DEV_DENY_SUPABASE_PROJECT_REF` in the hosted-dev doc.

Do not send real email or SMS, take payment, issue a refund, or link a bank, and do not submit those forms. Writes stay blocked unless the dev deployment itself reports outbound suppression.

A skipped or blocked check is not a pass. Say so in the report. Never print a secret. Redaction is described in the hosted-dev doc.

## Security focus

Tenant isolation and RLS: [`docs/security/iam-architecture.md`](security/iam-architecture.md) and [`supabase/tests/rls/`](../supabase/tests/rls/). API routes need auth. Service-role access (`createAdminClient()`, `SUPABASE_SERVICE_ROLE_KEY`) comes only after an authorization check (same IAM doc). Tenant claims (`app_role`, `tenant_role`, `current_tenant_id`, masquerade target) come only from Auth `app_metadata`, never `user_metadata` ([`docs/agents/tenant-claims-user-metadata.md`](agents/tenant-claims-user-metadata.md), [`lib/auth/types.ts`](../lib/auth/types.ts)). Do not widen the auth cookie domain. Do not weaken `platformAdminFixtureBlock` ([`lib/hosted-dev/rlsAssertions.ts`](../lib/hosted-dev/rlsAssertions.ts)).

## How deep

- **Docs-only:** CI on the pull request is enough.
- **Low-risk:** CI, `npm run build`, Playwright smoke, and the area the diff touches.
- **Full:** an end-to-end browser pass of the changed flow on local or hosted dev, plus the security probes above.
- After a fix, re-test the fix commits and every check that failed the first time.

## Report

Post one pull-request review comment:

- **Verdict:** `PASS`, `PASS WITH NOTES`, or `FAIL`.
- What passed, by command or flow.
- Bugs, with repro steps and severity.
- Anything skipped or blocked, with the reason.

## Known follow-ups

None.
