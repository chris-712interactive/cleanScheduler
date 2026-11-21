# Local QA stack (session notes)

QA agents were marking office sign-in, the customer portal, RLS SQL, and `npm run geocode:backfill` as blocked because the VM had no database, no Docker, and no QA secrets. The owner declined `HOSTED_DEV_ISOLATED`. Do not turn that on, and do not point `DATABASE_URL` at dev or prod.

`npm run test:local-stack` is the command. The `local-stack` job in `.github/workflows/ci.yml` runs it on the GitHub runner with Supabase CLI 3.2.0. `RLS_SMOKE_REQUIRED=1` is set only there. The quality job still skips `check:rls-smoke` when `DATABASE_URL` is unset, and that skip is still not a pass.

Without Docker, `--postgres-fallback` is the RLS path. Playwright and the backfill need the Supabase API. Say so. A green fallback is a pass of the six SQL files. `text_pack_ledger.sql` checks that a member can read their own text pack balance, cannot read another tenant, and cannot insert, update, or consume credits.

`CENSUS_GEOCODE_URL` is ignored unless it is loopback `http`. The stub treats "outage" as HTTP 503 and "nomatch" as an empty Census match list.

Seed emails are `@example.test`. The seed throws before it constructs a client if the URL is not local. Claims go to `app_metadata` only. Five workspaces: residential (Business), commercial (Starter), pro, trial (`trialing`), and past due (Pro, `past_due`). The last two exist so routing gates can be checked without Stripe.

Migration `0129` is applied to the disposable database because it is a file in `supabase/migrations`. That does not authorize applying it to a hosted project. `0134` is already on shared dev and production; do not edit it. `0135_route_base_active_member.sql` is the active-member check for office route-base writes. An agent does not apply `0135` to a hosted database. The disposable local stack does, and `pro_routing_extras.sql` rejects a non-member `user_id` while a member insert still succeeds.

Auth cookies stay host-only. The browser isolation check is on `qa-residential`: Quinn Example is absent from the directory, search, and the direct customer URL.

`tests/local-stack/authenticated.spec.ts` reads the text pack block with `page.locator('#main').getByRole('region', { name: 'Text packs' }).first()`. The page source has one `#text-packs`. A route swap can leave a second copy in the document, and `locator('#text-packs')` then fails Playwright strict mode. The visible region in `#main` is the one the test checks.
