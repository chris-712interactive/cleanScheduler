# Local QA stack

Disposable Supabase for pull-request CI and for a QA agent on a laptop or a Cursor cloud VM. Nothing here talks to the shared dev project or to production. A database URL must name a loopback host and must not contain `#` or `%23`. Its query string may only contain `sslmode`, `connect_timeout`, and `application_name`. `psql` is started with `-h`, `-p`, `-U`, and `-d` as separate arguments, never with the URL. Parent `PG*` variables are removed. `PGPASSWORD` comes only from the parsed URL. `PGSERVICEFILE` and `PGSYSCONFDIR` point at paths that do not exist.

## One command

```bash
npm run test:local-stack
```

That starts the Supabase CLI (Docker), applies `supabase/migrations` in order, seeds two fake workspaces, runs the RLS SQL with `RLS_SMOKE_REQUIRED=1`, builds the app, runs the authenticated Playwright suite, then runs `scripts/backfill-property-geocodes.mts` against a loopback geocoder. Containers stop at the end.

Flags:

- `--keep` leaves Supabase running.
- `--skip-build` reuses `.next` (the app must already have been built with the local URL).
- `--skip-browser` skips Playwright.
- `--postgres-fallback` uses plain Postgres and runs only the RLS SQL.

First runs download the Supabase images and then build Next.js. The GitHub job allows 45 minutes. Later runs on a warm Docker cache are shorter. The browser suite is one Chromium worker.

Results:

- Console line `check:rls-smoke — passed 3 SQL files`
- Console line `authenticated playwright passed=`
- Console line `geocode backfill smoke passed`
- `.local-stack/summary.txt` (gitignored)
- Screenshots under `test-results/local-stack/` and the Playwright output directory

The CI job uploads those paths as the `local-stack-results` artifact. The summary file does not contain keys.

## Seed

`npm run seed:local-stack` after the API is up. Accounts live in `scripts/local-stack/qa-accounts.json`. Emails are `@example.test`. The password is a constant for this local stack only. The script writes Auth claims to `app_metadata` and exits before creating a client if `NEXT_PUBLIC_SUPABASE_URL` is not `http` on loopback, or if `DATABASE_URL` is set and is not a loopback Postgres URL.

Workspaces:

- `qa-residential.lvh.me:3000` — owner, admin, field cleaner, customer-portal user, two customers. Locations include a stored point, a `no_match`, and a `lookup_failed` that is old enough for backfill to retry.
- `qa-commercial.lvh.me:3000` — owner and one customer the residential owner must not see.

Visits are scheduled for today in `America/New_York`.

Sign in on the workspace host or on `http://my.lvh.me:3000`. Cookies are not shared across those hosts.

## Geocoder

`scripts/local-stack/geocode-stub.mjs` listens on `127.0.0.1:5499`. The app and the backfill read `CENSUS_GEOCODE_URL` only when it is `http` on loopback. `GEOCODIO_API_KEY` is unset. No Census or Geocodio traffic.

## No Docker

Cursor cloud VMs often cannot run Docker. `.cursor/environment.json` installs dependencies, the Supabase CLI, and PostgreSQL when `apt` works. It does not boot the stack. The boot script only prints which command to use.

```bash
npm run test:local-stack -- --postgres-fallback
```

This creates `.local-stack/pgdata`, applies a small auth/storage bootstrap, then every migration. If the `pg_cron` package is missing, migration `0021` is applied as `scripts/local-stack/pg-cron-shim.sql` (the expire function from `0020` is unchanged; no real cron job runs). The Supabase image used in CI includes `pg_cron`, so that job runs the real migration file.

The fallback does not start GoTrue. Do not describe Playwright or the backfill script as passed in that mode.

## What this does not change

Hosted dev, `HOSTED_DEV_ISOLATED`, Vercel env, cookie domain, `platformAdminFixtureBlock`, and the rule that tenant claims come from `app_metadata` are untouched. No email, SMS, or payment provider is configured.
