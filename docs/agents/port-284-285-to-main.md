# Port #284 and #285 onto main

Learned while cherry-picking the `dev` squashes onto `origin/main` `b7ae63ac69efb6ee465aaf9ac1fecd74f892ce82` (#283).

Source commits, in order:

- #284 `d3586807d76ab58cda10cee014884d794570f3c3` — prepaid text packs and a Business applicant SMS cap. Texting and pack checkout require an active paid subscription. Packs are credited only from the verified Stripe webhook. The monthly allowance is used before pack segments, under one tenant lock. Adds `supabase/migrations/0131_text_pack_ledger.sql` and `supabase/tests/rls/text_pack_ledger.sql`. The same squash retries the local Supabase start when port 54322 is busy.
- #285 `d719b31f4aeaa57b5379cf2c24ee18b20ad8e735` — raw Stripe subscription status. A paused subscription blocks texting. A partial send refunds each channel that was not logged. `customer.subscription.paused` and `customer.subscription.resumed` use the existing subscription sync. Adds `supabase/migrations/0132_stripe_subscription_status.sql`.

`0131` and `0132` were already applied by hand on prod. This port does not apply them to prod or to any hosted database. The disposable Postgres from `npm run test:local-stack -- --postgres-fallback` applies every migration, including `0131` and `0132`, under `.local-stack/pgdata`. No CI step was added. `.github/workflows/ci.yml` and `.github/workflows/hosted-dev.yml` are unchanged. No live Stripe or SMS call was made.

## Conflicts

#284 conflicted only in `docs/product/implementation-status-summary.md`.

Main already had a portal-host paragraph (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal). That paragraph stayed, and the `Branch: dev` line kept main's formatting (no two trailing spaces). The text-pack sentences were inserted at the start of **Latest polish**.

#285 applied with no conflicts. It does not edit that summary, so the text-pack paragraph stayed as #284 wrote it.

Every other file in these two commits matches `origin/dev` (`d719b31`). Nothing in either commit needed a `dev` change that is missing from main.

## Checks on the port VM

Docker is not available here, so authenticated Playwright and the geocode backfill were not run. `npm run test:local-stack -- --postgres-fallback` applied 132 migrations on loopback Postgres 16 and printed `check:rls-smoke — passed 6 SQL files`. The summary is `rls=passed`, `playwright=blocked docker-required`, `backfill=blocked docker-required`. The GitHub `local-stack` job is the run that must show Playwright and `geocode backfill smoke passed`. The RLS count there is `rls_sql_files=6`.

`npm test` was 950 passed (177 files). Typecheck, lint, stylelint, `format:check`, both migration checks, and `npm run build` from a verbatim `.env.example` passed. The build includes `/tenant/billing`.

Do not merge this port without the owner's yes. Do not dispatch `hosted-dev.yml`.
