# QA brief

Read this before testing a pull request. Name env vars and where they are configured. Do not paste secret values, real emails, tenant ids, or slugs into comments, logs, or this file.

## Suites

**Vitest.** `npm run test` ([`vitest.config.ts`](../vitest.config.ts), `**/*.test.ts`). Node is [`.nvmrc`](../.nvmrc). No secrets. The `quality` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs this with typecheck, Prettier, migration checks, ESLint, and Stylelint. That job does not run the production build or Playwright.

**Playwright smoke.** `npm run test:e2e` ([`playwright.smoke.config.ts`](../playwright.smoke.config.ts), [`tests/smoke`](../tests/smoke)). `PLAYWRIGHT_BASE_URL` defaults to `http://127.0.0.1:3000`. When `CI` is set, that config starts `npm run start`, so build first. Locally, start the app yourself ([`README.md`](../README.md)). This suite does not sign in.

**Local stack (authenticated browser, RLS, geocode backfill).** `npm run test:local-stack`. Details: [`docs/ops/local-stack.md`](ops/local-stack.md). The `local-stack` CI job runs this on every pull request against a disposable Supabase started from this branch's `supabase/migrations`. It uses the CLI's local demo keys. It does not use GitHub secrets, the shared dev project, or production.

When that command finishes with `mode=supabase-docker` and `rls=passed`, do not mark RLS, office sign-in, customer-portal sign-in, or `npm run geocode:backfill` as blocked. The job log and `.local-stack/summary.txt` include the RLS file count (`rls_sql_files=4` and `check:rls-smoke — passed 4 SQL files`) and the Playwright counts (`authenticated playwright passed=`).

`npm run check:rls-smoke` ([`scripts/check-rls-smoke.mjs`](../scripts/check-rls-smoke.mjs)) runs the SQL under [`supabase/tests/rls/`](../supabase/tests/rls/) except `hosted_dev_cross_tenant.sql`. If `DATABASE_URL` is unset it exits 0 and prints that it skipped. That exit is not a pass. The local-stack command sets `RLS_SMOKE_REQUIRED=1`, and a missing or non-local database fails the command. The URL must name a loopback host and must not contain `#` or `%23`. Only `sslmode`, `connect_timeout`, and `application_name` are allowed in the query string. `psql` receives `-h`, `-p`, `-U`, and `-d` separately, never the URL. Every parent `PG*` variable is removed, and service-file paths point at locations that do not exist. [`hosted_dev_cross_tenant.sql`](../supabase/tests/rls/hosted_dev_cross_tenant.sql) still runs only inside the isolated hosted-dev job.

**No Docker.** QA VMs often have no Docker. `npm run test:local-stack` then exits 1 and does not pretend the browser suite ran. Run `npm run test:local-stack -- --postgres-fallback`. That applies the migrations to a loopback Postgres (install `postgresql` and `postgresql-contrib` first) and runs the RLS SQL for real. Report RLS as passed when it prints `check:rls-smoke — passed 4 SQL files`. Authenticated Playwright and the geocode backfill stay blocked in that mode because they need GoTrue and PostgREST. Say that Docker was missing. Do not mark RLS blocked when the fallback passed.

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

The local stack does not cover live Census or Geocodio, real email, SMS, card charges, bank linking, passkey or MFA enrollment, or the hosted-dev project. Do not dispatch the hosted-dev workflow and do not set `HOSTED_DEV_ISOLATED` to fill those gaps. Auth cookies stay on the host that set them, so the cross-tenant browser check is the signed-in workspace: the other tenant's customer is absent from the directory and a direct customer URL on that host is a 404.
