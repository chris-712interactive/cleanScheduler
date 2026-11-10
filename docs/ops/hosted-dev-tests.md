# Hosted dev tests

Read-only smoke runs against `https://dev.cleanscheduler.com` and its single-label subdomains. Authenticated reads and cross-tenant RLS run only when `HOSTED_DEV_ISOLATED=1`. Writes, booking submission, charges, refunds, bank linking, email, SMS, and cron batches stay blocked: this app has no single dev-only switch that suppresses Resend, sent.dm, Stripe, and Plaid together.

The existing `CI` workflow and `npm run test:e2e` local smoke are unchanged.

## Commands

```bash
npm run test:hosted-dev
HOSTED_DEV_ISOLATED=1 npm run test:hosted-dev:isolated
```

`test:hosted-dev` refuses any base URL other than `https://dev.cleanscheduler.com` (subdomains are allowed inside the browser). Set `HOSTED_DEV_EXPECT_SHA` to the deployed commit. The suite loads `GET /api/health/deployment`, checks `appEnv=dev`, the dev domain, a non-live Stripe publishable key, and a non-production Plaid env, and retries a SHA mismatch for about 50 seconds. A production identity aborts before page checks. A missing identity endpoint fails the identity check and still allows the public reads on the allowlisted host.

Blocked sections are listed in `hosted-dev-results/report.md`. They are not counted as passed. Skipped Playwright tests fail the summary.

## What smoke covers

- Marketing home, pricing, sign-in, password reset, and trial page render without submitting those forms
- `admin`, `my`, and an unknown tenant host redirect to sign-in on that same host
- `www.dev.cleanscheduler.com` returns to the apex
- Cron routes, the Stripe webhook, and the Plaid link-token route reject unauthenticated calls
- Public booking render, only when `HOSTED_DEV_BOOKING_URL` is an allowlisted URL

## What isolated covers

Dedicated QA users only. The suite does not create accounts, send invites, or submit payment, booking, or message forms.

- Residential and commercial owners: schedule, recurring list, customers, quotes, billing, and the saved service segment. It does not click save.
- Residential session copied onto the commercial host must see “No access to this workspace”, not that customer list
- Platform admin: founder or sales dashboard, and the tenant list for a founder, with no edits
- Customer: home, quotes, visits, and invoices, with no payment
- Two fixture users, through the dev Supabase Auth password grant and `tenant_quotes` select, must see only their own `qa-hosted-dev-*` quote
- Direct `psql` runs only when `QA_DEV_DATABASE_URL` is the same dev project the identity endpoint reported

`HOSTED_DEV_MUTATIONS=1` does not enable writes. It fails the run and records the suppression gap.

## GitHub Actions

Workflow: `.github/workflows/hosted-dev.yml`.

GitHub runs `deployment_status` and `workflow_dispatch` from the default branch, `main`. Merging this file to `dev` does not start it. After it is on `main`:

- A successful Vercel deployment whose GitHub environment is exactly `dev`, whose creator is `vercel[bot]`, which is not a production deployment, and whose commit is on `origin/dev`, checks out that commit and runs smoke.
- Preview and Production deployments do not run the jobs.
- The live check target is always `https://dev.cleanscheduler.com`. The `*.vercel.app` status URL is not opened. If the alias SHA differs from the event SHA, smoke fails after the bounded retry.
- One run is queued at a time. The ancestor check retries five times, ten seconds apart.
- Smoke installs dependencies with `npm ci --ignore-scripts` and has no repository credentials.
- Isolated is skipped unless the workflow file that is executing is the `main` copy and the repository variable `HOSTED_DEV_ISOLATED` is `1`. Missing QA configuration fails that job. It does not pass quietly.
- Manual dispatch also has to be started from `main`, with the deployed dev SHA. The SHA must be on `origin/dev`.
- Reports and masked failure screenshots upload as artifacts for seven days. Traces and text results are redacted for secrets, emails, tokens, and database URLs. Isolated tests do not record Playwright traces, because a trace would contain the password.

No Vercel token is required. The existing CI workflow is not modified.

## Repository variables

| Name                                   | Purpose                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| `HOSTED_DEV_ISOLATED`                  | Set to `1` to run authenticated reads and RLS after smoke passes. |
| `HOSTED_DEV_MUTATIONS`                 | Leave unset. `1` fails on purpose.                                |
| `HOSTED_DEV_BOOKING_URL`               | Optional allowlisted `/book` URL for the read-only booking check. |
| `HOSTED_DEV_DENY_SUPABASE_PROJECT_REF` | Optional production Supabase project ref. A match fails closed.   |
| `QA_TENANT_RESIDENTIAL_SEGMENT`        | Optional. Defaults to `residential`.                              |
| `QA_TENANT_COMMERCIAL_SEGMENT`         | Optional. Defaults to `commercial`.                               |

## Repository secrets for the isolated job

Set these on the dev QA users and fixture quotes only. Do not copy production values.

- `QA_TENANT_RESIDENTIAL_EMAIL`
- `QA_TENANT_RESIDENTIAL_PASSWORD`
- `QA_TENANT_RESIDENTIAL_SLUG`
- `QA_TENANT_COMMERCIAL_EMAIL`
- `QA_TENANT_COMMERCIAL_PASSWORD`
- `QA_TENANT_COMMERCIAL_SLUG`
- `QA_ADMIN_EMAIL`
- `QA_ADMIN_PASSWORD`
- `QA_CUSTOMER_EMAIL`
- `QA_CUSTOMER_PASSWORD`
- `QA_DEV_SUPABASE_URL`
- `QA_DEV_SUPABASE_ANON_KEY`
- `QA_RLS_USER_A_EMAIL`
- `QA_RLS_USER_A_PASSWORD`
- `QA_RLS_USER_B_EMAIL`
- `QA_RLS_USER_B_PASSWORD`
- `QA_RLS_TENANT_A_ID`
- `QA_RLS_TENANT_B_ID`
- `QA_RLS_MARKER_A`
- `QA_RLS_MARKER_B`

Markers must match `qa-hosted-dev-` plus 1–48 letters, numbers, or hyphens. They are the `tenant_quotes.title` values, one on each fixture tenant. The two users must be members of only their own tenant and must not be platform admins. Turn off MFA for these users; a two-factor challenge is blocked rather than bypassed.

Optional direct SQL, still the dev project only:

- `QA_DEV_DATABASE_URL`
- `QA_RLS_USER_A_ID`
- `QA_RLS_USER_B_ID`

People who can push to `dev` can change the checked-out tests. Isolated credentials are injected only by the `main` workflow, after the commit is shown to be on `origin/dev`, and only into the Playwright step. Treat push access to `dev` as access to those QA secrets once the variable is enabled.
