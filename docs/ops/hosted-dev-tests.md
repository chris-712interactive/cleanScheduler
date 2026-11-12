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

- Marketing home, pricing, sign-in, password reset, and trial page render without submitting those forms. The check fails on `POST`, `PUT`, `PATCH`, and `DELETE` to the dev host. It allows `OPTIONS`. On hosted Vercel deploys, Next.js injects `https://vercel.live/_next-live/feedback/feedback.js`, which calls `fetch("/", { method: "OPTIONS" })` to read `x-robots-tag` before showing the toolbar. That request has no body and does not run the trial or password-reset actions. The 2026-11-10 failure was this OPTIONS while `/forgot-password` was open. `/start-trial` rendered and did not POST.
- `admin`, `my`, and an unknown tenant host redirect to sign-in on that same host
- `www.dev.cleanscheduler.com` returns to the apex
- Cron routes, the Stripe webhook, and the Plaid link-token route reject unauthenticated calls
- Public booking render, only when `HOSTED_DEV_BOOKING_URL` is an allowlisted URL

## What isolated covers

Dedicated QA users only. The suite does not create accounts, send invites, or submit payment, booking, or message forms.

- Residential and commercial owners: schedule, recurring list, customers, quotes, billing, and the saved service segment. It does not click save. Customers, Quotes, and Billing match a level-1 heading that contains an element whose text is exactly that title. The hint control inside the heading does not hide the title. A heading such as “Billing settings” does not count as “Billing”.
- Sign-in submits in the background. The helper waits until the browser leaves `/sign-in`, stops on `/sign-in/mfa` or a deeper MFA path, or changes host. `domcontentloaded` on the already open sign-in page is not a finished login. Any MFA path is blocked. If the sign-in page is still open on the same host after 20 seconds, the run is blocked because the session cookie was not confirmed. Leaving that host fails and names the landing URL. It is not reported as a stuck sign-in page.
- Paths opened after sign-in are resolved on the host already open. Playwright’s base URL is `https://dev.cleanscheduler.com`, so a relative `goto('/quotes')` would request the marketing apex. `/quotes`, `/schedule/recurring`, and `/tenants` on that apex are marketing 404s (“We can't find that page”). The suite builds an absolute URL on the current host instead. If that navigation follows a redirect onto another host, the check fails and names both hosts.
- Residential session copied onto the commercial host waits until one heading is visible, then reports that outcome with the landing URL (email addresses redacted, including `%40`, and `token`, `code`, and `email` query values). “No access to this workspace” passes. “Customers” fails. “Sign in to Clean Scheduler” is blocked. A page that shows none of those three is a separate blocked result and includes the heading text. The check does not guess that the cookie failed to authenticate. A platform `app_role` of `admin` does not open the other workspace. Entry without a membership requires a masquerade session aimed at that tenant. RLS allows `admin` and `super_admin` to read a tenant's rows only while `has_live_support_session` is true for that tenant (`0126_support_session_tenant_rls.sql`). A blocked RLS fixture stays a data problem until that Auth user is demoted, because `platformAdminFixtureBlock` still rejects platform-admin tokens before the query.
- Platform admin: founder or sales dashboard on `admin.dev.cleanscheduler.com`, and the tenant list for a founder, with no edits. Platform staff (`super_admin`, `admin`, and `sales`) who sign in on that admin host stay there, including when they also have a workspace membership. The session cookie is not sent to another host, so a redirect onto a workspace host lands on that host’s sign-in page. That host change fails during sign-in. Until the deployed dev app keeps them on the admin host, the QA platform admin needs no active tenant memberships. After that deploy, a workspace membership must not pull this sign-in off the admin host. The cookie domain is not widened to a parent domain. A normal sign-in on the admin host does not follow a workspace redirect. Support entry uses a separate one-time handoff at `/auth/masquerade-handoff` on the tenant host.
- Customer: home, quotes, visits, and invoices, with no payment. Those paths stay on `my.dev.cleanscheduler.com`. Visits require a level-1 heading with an element whose text is exactly “Upcoming visits”. The empty state “No upcoming visits” does not satisfy that check.
- Two fixture users, through the dev Supabase Auth password grant and `tenant_quotes` select, must see only their own `qa-hosted-dev-*` quote
- Direct `psql` runs only on a machine where you set `QA_DEV_DATABASE_URL` yourself, and only when that URL is the dev project the identity endpoint reported. GitHub does not inject that URL.
- The Auth token for each RLS fixture user is rejected when it is a platform admin or the service role.

`HOSTED_DEV_MUTATIONS=1` does not enable writes. It fails the run and records the suppression gap.

## GitHub Actions

Workflow: `.github/workflows/hosted-dev.yml`.

`deployment_status` runs the workflow file from the deployed commit, not from the default branch. [Actions run 42820960835](https://github.com/chris-712interactive/cleanScheduler/actions/runs/42820960835) ran from `dev` at `69bbe28` on 2026-11-10 13:02Z, before this file existed on `main`. A push to `dev` can delete every condition in that file and still receive repository secrets. YAML conditions are defense in depth. They are not the secret boundary.

The secret boundary is a GitHub Actions environment named `hosted-dev-isolated`.

- Its deployment branch policy allows only the branch `main`. GitHub matches that rule against the workflow run's `GITHUB_REF` (`refs/heads/main`).
- The QA secrets below are environment secrets on `hosted-dev-isolated`. They are not repository secrets. A job that never declares the environment can still read repository secrets, including a workflow edited on `dev`.
- The isolated job sets `environment: hosted-dev-isolated`. GitHub applies the branch policy before it injects those secrets. A run whose `GITHUB_REF` is `refs/heads/dev`, and a deployment whose ref is a raw commit SHA (`GITHUB_REF` empty), do not match `main`. The job fails closed. The runner does not receive the secrets.
- Smoke does not set an environment and does not receive QA secrets.
- Do not add `dev` to the branch policy. That would give the secrets to the workflow file GitHub executes for a dev deploy.

What the workflow still checks, after this file is on the branch GitHub executes:

- A successful Vercel deployment whose GitHub environment name is exactly `dev`, whose creator is `vercel[bot]`, which is not marked production, and whose commit is the current `origin/dev` tip, runs smoke from that tip. An older ancestor, including a reverted commit, does not run. The tip check retries five times, ten seconds apart.
- The name check stays required. A deployment named `Production` has been seen with `production_environment: false`. That boolean is an extra filter. It does not by itself mean the target is dev. Preview and Production deployments do not run the jobs.
- The live check target is always `https://dev.cleanscheduler.com`. The `*.vercel.app` status URL is not opened. If the alias SHA differs from the tip, smoke fails after the bounded retry.
- One run is queued at a time.
- Smoke installs dependencies with `npm ci --ignore-scripts` and has no QA credentials. It does execute the tip's own test script.
- Isolated stays opt-in. Leave the repository variable `HOSTED_DEV_ISOLATED` unset. The job's `if` also requires smoke to succeed and `github.workflow_ref` to end with `@refs/heads/main`. Editing the workflow on `dev` can remove that `if`. The environment policy still withholds the secrets.
- The isolated job checks out `main`, not the deployed commit, and refuses to start if `origin/dev` moved. Checkout, Node setup, and artifact upload in that job are pinned to full commit SHAs. Missing QA configuration fails that job. It does not pass quietly.
- Automatic `deployment_status` runs from `dev` do not receive isolated secrets, even if `HOSTED_DEV_ISOLATED` is later set to `1`, because `github.ref` is not `main`. To run isolated reads, dispatch the workflow from `main` after the environment, the branch policy, and the environment secrets exist, and only then set the variable to `1`. This change does not set it.
- Automatic runs do not receive `QA_DEV_DATABASE_URL` or the RLS user ids. Direct SQL stays a manual local run.
- Manual dispatch has to be started from `main`, and the SHA has to be the current `origin/dev` tip.
- Reports upload as artifacts for seven days only after `scripts/hosted-dev/redact-artifacts.mts` finishes and writes `.redaction-complete`. If that script fails, trace zips and images are deleted and nothing is uploaded. Text, HTML, and HAR contents are redacted, including short configured secrets, `sb_secret_…`, `whsec_…`, the whole Authorization or Bearer value, email addresses (including `%40` and bounded `%2540` encodings), and credential query or fragment values (`token`, `code`, `email`, `access_token`, `refresh_token`, `id_token`, `provider_token`, `provider_refresh_token`, `code_verifier`, `client_secret`, `token_hash`, and the camel-case `idToken` / `accessToken` forms). The result summary is redacted before it is printed. Trace-zip entries are scrubbed even when the name has no extension. Images are removed by magic bytes, not by file name. Isolated tests do not record Playwright traces.

No Vercel token is required. The existing CI workflow is not modified.

## Repository variables

| Name                                   | Purpose                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `HOSTED_DEV_ISOLATED`                  | Leave unset. `1` asks the isolated job to run. Secrets stay withheld unless the run ref is allowed by the environment. |
| `HOSTED_DEV_MUTATIONS`                 | Leave unset. `1` fails on purpose.                                                                                     |
| `HOSTED_DEV_BOOKING_URL`               | Optional allowlisted `/book` URL for the read-only booking check.                                                      |
| `HOSTED_DEV_DENY_SUPABASE_PROJECT_REF` | Optional production Supabase project ref. A match fails closed.                                                        |
| `QA_TENANT_RESIDENTIAL_SEGMENT`        | Optional. Defaults to `residential`.                                                                                   |
| `QA_TENANT_COMMERCIAL_SEGMENT`         | Optional. Defaults to `commercial`.                                                                                    |

## Environment secrets for the isolated job

Create these on the `hosted-dev-isolated` environment. Do not create them as repository Actions secrets, and do not put them in repository variables. Values are the dev QA users and fixture quotes only. Do not copy production values.

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

Markers must match `qa-hosted-dev-` plus 1–48 letters, numbers, or hyphens. They are the `tenant_quotes.title` values, one on each fixture tenant. Each RLS user is a member of only their own fixture tenant. The membership role may be owner, admin, employee, or viewer. “Tenant admin” means that membership role on that tenant only. It is not a platform role. `app_metadata.app_role` must not be `admin` or `super_admin`, and the token must not be `service_role`. Those platform roles bypass tenant RLS. The suite blocks when the Auth token says so. It does not count that read as a pass. A block here is fixture data: change that Auth user’s `app_metadata.app_role` so it is not a platform role. Do not change product RLS to make the token pass. HTTP 403 on that quote probe for an employee who already has an active membership is Postgres `42501` from `has_tenant_membership` when that helper runs as the caller and `authenticated` cannot `SELECT` `tenant_memberships`. That is a product bug in the helper, not a fixture problem. Do not grant `authenticated` `SELECT` on `tenant_memberships` (the membership policy calls the helper), and do not change `platformAdminFixtureBlock`. Turn off MFA for these users; a two-factor challenge is blocked rather than bypassed.

Optional direct SQL, local only, still the dev project only. Do not add these to GitHub at all:

- `QA_DEV_DATABASE_URL`
- `QA_RLS_USER_A_ID`
- `QA_RLS_USER_B_ID`

### GitHub settings still required

Creating the environment needs repository administration. The token available to this change received HTTP 403 (`administration=write`) from `PUT /repos/chris-712interactive/cleanScheduler/environments/hosted-dev-isolated`. Listing Actions secrets and variables also returned 403. Nothing below is already applied. `HOSTED_DEV_ISOLATED` was not set. No secret values were read or written.

On 2026-11-10 the repository environments were `dev`, `Preview`, and `Production`. `hosted-dev-isolated` was not among them. The `dev` environment had no deployment branch policy.

Apply these steps before adding any QA secret. If a workflow run names `hosted-dev-isolated` before you create it, GitHub creates that environment with no branch policy and no secrets. Do not add secrets to an environment that still says "No restriction".

1. Open [Environments](https://github.com/chris-712interactive/cleanScheduler/settings/environments).
2. Choose **New environment**. Name it `hosted-dev-isolated`. Open **Configure**.
3. Under **Deployment branches and tags**, choose **Selected branches and tags**.
4. Add one deployment branch rule. Ref type: **Branch**. Name pattern: `main`.
5. Do not add a rule for `dev`, `*`, tags, or `refs/pull/*/merge`. A branch pattern of `main` matches `refs/heads/main` only.
6. Leave required reviewers and the wait timer empty. Reviewers are not a substitute for the branch rule.
7. Under **Environment secrets**, add each name in the list above. Do not add `QA_DEV_DATABASE_URL`, `QA_RLS_USER_A_ID`, or `QA_RLS_USER_B_ID`.
8. Open [Actions secrets and variables](https://github.com/chris-712interactive/cleanScheduler/settings/secrets/actions). Under **Repository secrets**, delete any secret whose name is in the list above. A repository copy stays readable by a workflow on `dev` that does not declare the environment.
9. Under **Repository variables**, leave `HOSTED_DEV_ISOLATED` unset. Do not set it to `1` as part of this hardening.
10. On the environment page, confirm the policy is **Selected branches and tags** and the only rule is branch `main` before any isolated dispatch.

## Residual risk

The environment policy is the control that stops a modified `dev` workflow from receiving QA secrets. It works only after the steps above are done and the repository secret copies are gone. Until then, any repository secret with these names is still available to the workflow file on `dev`.

Do not add `dev` to the branch policy to make automatic isolated runs pass. Automatic `deployment_status` runs from `dev` are supposed to fail closed for secrets.

Once a `main` dispatch is allowed to receive the secrets, isolated tests log into the live dev site. The deployed `dev` app sees those passwords in the sign-in request. A malicious tip can collect them there even though the test script is checked out from `main`.

`main` must contain this suite before that dispatch can pass. If `dev` changes the UI before `main` does, the isolated job fails until `main` is updated. That failure is intentional.

Smoke still runs the tip's test script. That job has no QA passwords, anon key, or database URL. A malicious tip can make network calls from smoke. It cannot read environment secrets that were never repository secrets and that smoke does not declare.

The fixture JWT check rejects `admin`, `super_admin`, and `service_role`. It reads the token Auth returned. It does not prove the database role separately from that token.
