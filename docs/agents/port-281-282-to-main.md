# Port #282 and #281 onto main

Learned while cherry-picking the `dev` squashes onto `origin/main` `24607972aedd65fd9c0948ed6e2ba6ecc7707846` (#280).

Source commits, in order:

- #282 `f7f2e0b30b27963b4806d2af049351f224a70e2b` — suggested stop order for one cleaner. Haversine nearest-neighbor plus 2-opt. Saves `route_sequence` when migration `0130` is present. Schedule and day-map reads retry without that column. Adds `supabase/migrations/0130_visit_route_sequence.sql` and `supabase/tests/rls/visit_route_sequence.sql`.
- #281 `ad7dad7296f09ea1ba2abe998e078d33f9a30e8c` — plan-tier upgrade copy instead of add-on purchases. Routing stays on Starter, Business, and Pro. No new prices. The day map is not gated. The browser check reads the Pro SMS panel only.

`0130` was already applied by hand on dev and prod. This port does not apply it to those databases. The disposable Postgres from `npm run test:local-stack -- --postgres-fallback` applies every migration, including `0130`, under `.local-stack/pgdata`. No CI step was added. `.github/workflows/ci.yml` and `.github/workflows/hosted-dev.yml` are unchanged. Cookie domain, `platformAdminFixtureBlock`, and Stripe prices are untouched.

## Conflicts

Both squashes conflicted only in `docs/product/implementation-status-summary.md`.

Main already had a portal-host paragraph (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal). That paragraph stayed, and the `Branch: dev` line kept main's formatting (no two trailing spaces).

#282's stop-order sentences were inserted at the start of **Latest polish**. #281 then replaced `and no new entitlement` with `Stop order is already included on every plan, so this screen is not gated.`

Every other file in these two commits matches `origin/dev` (`ad7dad7`). Nothing in either commit needed a `dev` change that is missing from main.

## Checks on the port VM

Docker is not available here, so authenticated Playwright and the geocode backfill were not run. `npm run test:local-stack -- --postgres-fallback` applied 130 migrations on loopback Postgres 16 and printed `check:rls-smoke — passed 5 SQL files`. The summary is `rls=passed`, `playwright=blocked docker-required`, `backfill=blocked docker-required`. The GitHub `local-stack` job is the run that must show Playwright and `geocode backfill smoke passed`. The RLS count there is `rls_sql_files=5`.

`npm test` was 921 passed (173 files). Typecheck, lint, stylelint, `format:check`, both migration checks, and `npm run build` from a verbatim `.env.example` passed. The build includes `/tenant/schedule/map`.

Do not merge this port without the owner's yes. Do not dispatch `hosted-dev.yml`.
