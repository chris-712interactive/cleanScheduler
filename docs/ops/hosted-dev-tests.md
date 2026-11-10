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
- Direct `psql` runs only on a machine where you set `QA_DEV_DATABASE_URL` yourself, and only when that URL is the dev project the identity endpoint reported. GitHub does not inject that URL.
- The Auth token for each RLS fixture user is rejected when it is a platform admin or the service role.

`HOSTED_DEV_MUTATIONS=1` does not enable writes. It fails the run and records the suppression gap.

## GitHub Actions

Workflow: `.github/workflows/hosted-dev.yml`.

GitHub runs `deployment_status` and `workflow_dispatch` from the default branch, `main`. Merging this file to `dev` does not start it. After it is on `main`:

- A successful Vercel deployment whose GitHub environment is exactly `dev`, whose creator is `vercel[bot]`, which is not a production deployment, and whose commit is the current `origin/dev` tip, runs smoke from that tip. An older ancestor, including a reverted commit, does not run. The tip check retries five times, ten seconds apart.
- Preview and Production deployments do not run the jobs.
- The live check target is always `https://dev.cleanscheduler.com`. The `*.vercel.app` status URL is not opened. If the alias SHA differs from the tip, smoke fails after the bounded retry.
- One run is queued at a time.
- Smoke installs dependencies with `npm ci --ignore-scripts` and has no QA credentials. It does execute the tip's own test script.
- Isolated is skipped unless the workflow file that is executing is the `main` copy and the repository variable `HOSTED_DEV_ISOLATED` is `1`. That job checks out `main`, not the deployed commit, and refuses to start if `origin/dev` moved. Checkout, Node setup, and artifact upload in that job are pinned to full commit SHAs. Missing QA configuration fails that job. It does not pass quietly.
- Automatic runs do not receive `QA_DEV_DATABASE_URL` or the RLS user ids. Direct SQL stays a manual local run.
- Manual dispatch has to be started from `main`, and the SHA has to be the current `origin/dev` tip.
- Reports upload as artifacts for seven days. Text, HTML, and HAR contents are redacted, including short configured secrets, `sb_secret_…`, `whsec_…`, and any Authorization or Bearer value. Trace-zip entries are scrubbed even when the name has no extension. Images are removed by magic bytes, not by file name. Isolated tests do not record Playwright traces.

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

Optional direct SQL, local only, still the dev project only. Do not add these to the GitHub workflow:

- `QA_DEV_DATABASE_URL`
- `QA_RLS_USER_A_ID`
- `QA_RLS_USER_B_ID`

## Residual risk

Isolated tests log into the live dev site. The current `dev` tip, once deployed, still receives those passwords in the real sign-in request. A malicious tip can collect them there even though the test script itself comes from `main`.

`main` must contain this suite before the isolated job can run. If `dev` changes the UI before `main` does, the isolated job fails until `main` is updated. That failure is intentional.

Smoke still runs the tip's test script. That job has no QA passwords, anon key, or database URL. A malicious tip can make network calls from smoke, and it cannot read the isolated job's secrets.

The fixture JWT check rejects `admin`, `super_admin`, and `service_role`. It reads the token Auth returned. It does not prove the database role separately from that token.
