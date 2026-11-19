# Port #279 and #278 onto main

Learned while cherry-picking the `dev` squashes onto `origin/main` `6da4ae3b68880e11b2eca8a48ada8c5b9600abcc` (#277).

Source commits, in order:

- #279 `b66338254b9cfae36c75071c211cbe6711484bd1` — disposable local Supabase for pull-request QA. RLS SQL, authenticated Playwright, and a stubbed geocode backfill. No hosted secrets.
- #278 `33a90d855dc1a452e31bb4ec8ea0d937efb95ace` — Schedule → Day map at `/schedule/map`. MapLibre pins for one day. Field employees do not get the page. No new migration.

`0129_property_geocode_metadata.sql` was already on main and on production. This port does not touch `supabase/migrations`. Tenant claims stay on `app_metadata`. The auth cookie domain is not widened. `platformAdminFixtureBlock`, `HOSTED_DEV_ISOLATED`, and the hosted-dev workflow environment are untouched.

## Conflicts

#279 applied with no conflicts.

#278 conflicted only in `docs/product/implementation-status-summary.md`. Main already had a portal-host paragraph from the host-classification port (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal). That paragraph stayed. The day-map sentences from #278 were inserted at the start of **Latest polish**, and the date became 2026-11-19. Prettier then removed the two trailing spaces on the `Branch: dev` line. The rest of that polish paragraph matched.

## CI workflow

`.github/workflows/ci.yml` on main already matched the parent of #279. The cherry-pick added the `local-stack` job beside `quality`. The quality job still checks out the PR head, runs in `node:22.22.1-bookworm`, and keeps dependency review.

Hosted-dev hardening is not in `ci.yml`. It is `.github/workflows/hosted-dev.yml`: the `authorize` job, then `hosted-dev-isolated` with `environment: hosted-dev-isolated`. That environment's deployment branch policy must allow only `main`. Neither squash changed that file. It is unchanged from main and matches `dev`.

## What was not pulled from dev

Nothing in either commit needed a `dev` change that is missing from main. After the cherry-picks, `git diff origin/dev` is only the pre-existing main-only docs and tests, plus the portal-host paragraph kept in the status summary.

`scripts/local-stack/` is byte-identical to `origin/dev`. Database URLs must name a loopback host. `#` and `%23` are refused. The query allowlist is `sslmode`, `connect_timeout`, and `application_name`. `psql` is started with `-h`, `-p`, `-U`, and `-d` (host `127.0.0.1` or `::1`), never with the URL. Parent `PG*` variables are removed. `PGSERVICEFILE` and `PGSYSCONFDIR` point at paths that do not exist.

## Checks on the port VM

Docker is not available on this VM, so authenticated Playwright and the geocode backfill were not run here. `npm run test:local-stack -- --postgres-fallback` printed `check:rls-smoke — passed 4 SQL files`: `tenant_isolation.sql`, `tenant_quotes_member_read.sql`, `support_session_tenant_read.sql`, and `day_map_visit_read.sql`. The fallback summary says Playwright and backfill are blocked without Docker. The GitHub `local-stack` job is the run that must show Playwright 6/6 and `geocode backfill smoke passed`.

`npm test` was 899 passed. Typecheck, lint, stylelint, `format:check`, both migration checks, `npm audit --omit=dev --audit-level=high`, and `npm run build` from a verbatim `.env.example` passed. The build includes `/tenant/schedule/map`.

Do not merge this port without the owner's yes. Do not dispatch `hosted-dev.yml`.
