# Hosted dev isolated run 104

Learned from Actions run 43765521341 (workflow `.github/workflows/hosted-dev.yml` dispatched from `main`, candidate `dev` sha `adf0c2a7`). Authorize and smoke passed. Isolated passed 7 of 8.

## Duplicate customer name

`createTenantCustomer` redirects to `/customers`. `app/tenant/customers/page.tsx` renders every row twice:

- `CustomersDirectoryTable` — a `<tr role="link" aria-label="View {name}">` with `<span class="customerName">`
- `CustomersDirectoryCards` — a real `<a>` with another `<span class="customerName">`, inside `.mobileList`

`.mobileList` is `display: none` from the `sm` breakpoint (480px) up. Playwright Desktop Chrome is 1280px wide, so the card is hidden, but `getByText(marker, { exact: true })` still matches both spans and strict mode throws. The customer was saved. The check that proves it is `getByRole('link', { name: 'View {marker}', exact: true })` on `{slug}.dev.cleanscheduler.com/customers`. The provider-host filter stays after that assertion.

## What the isolated job actually runs

The isolated job checks out `main`, not the deployed `dev` tip. `deployment_status` and `workflow_dispatch` also execute `.github/workflows/hosted-dev.yml` from `main` for a dispatch started on `main`. A fix that exists only on `dev` does not change the isolated job until it is ported to `main`. Smoke checks out the candidate sha, so smoke edits on `dev` do run.

`HOSTED_DEV_BOOKING_URL` is a repository Actions variable. Smoke already maps `vars.HOSTED_DEV_BOOKING_URL`. The isolated report said the booking read was blocked because the isolated job never received the variable, and the booking test lived only in `smoke.spec.ts`. Both jobs now receive the variable, and both suites open the page when it is set. An empty value stays `blocked` and is not a pass.

`QA_DEV_DATABASE_URL` is an environment secret on `hosted-dev-isolated`, not a repository secret. The isolated job maps `secrets.QA_DEV_DATABASE_URL`. `secretsFromEnv` already treats a name containing `DATABASE_URL` as a secret, and the postgres URL pattern is stripped as well. Do not print the value. An empty secret leaves direct SQL `blocked` and is not a pass.

The SQL file also needs `QA_RLS_USER_A_ID` and `QA_RLS_USER_B_ID`. Those are environment secrets on the same environment. If either is empty, the test reports `blocked` and the run does not pass.

`psql` ignores a return code on `\quit`, so `\quit 1` exits 0 after printing `FAIL` or `BLOCKED`. The SQL file raises those verdicts as a bad integer cast, and `directSqlRlsOutcome` refuses a zero exit that still contains `FAIL:` or `BLOCKED:`. A connection error does not copy client output into the thrown message.

`assertDevDatabaseUrl` accepts a connection only when the deployment identity host and the URL are both project `khodybakkdpheqkoycgi` (direct host `db.khodybakkdpheqkoycgi.supabase.co`, or pooler user `postgres.khodybakkdpheqkoycgi`). The isolated job still runs only from the trusted `main` workflow, with the `origin/dev` tip check, dev-only target guards, and `platformAdminFixtureBlock` unchanged. Do not widen the cookie domain. Do not trust `user_metadata`.
