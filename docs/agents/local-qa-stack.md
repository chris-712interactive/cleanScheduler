# Local QA stack (session notes)

QA agents were marking office sign-in, the customer portal, RLS SQL, and `npm run geocode:backfill` as blocked because the VM had no database, no Docker, and no QA secrets. The owner declined `HOSTED_DEV_ISOLATED`. Do not turn that on, and do not point `DATABASE_URL` at dev or prod.

`npm run test:local-stack` is the command. The `local-stack` job in `.github/workflows/ci.yml` runs it on the GitHub runner with Supabase CLI 3.2.0. `RLS_SMOKE_REQUIRED=1` is set only there. The quality job still skips `check:rls-smoke` when `DATABASE_URL` is unset, and that skip is still not a pass.

Without Docker, `--postgres-fallback` is the RLS path. Playwright and the backfill need the Supabase API. Say so. A green fallback is a pass of the four SQL files only. The fourth file is `day_map_visit_read.sql`: a member can read their own visit point and cannot read the other tenant's visit or address.

`CENSUS_GEOCODE_URL` is ignored unless it is loopback `http`. The stub treats "outage" as HTTP 503 and "nomatch" as an empty Census match list.

Seed emails are `@example.test`. The seed throws before it constructs a client if the URL is not local. Claims go to `app_metadata` only.

Migration `0129` is applied to the disposable database because it is a file in `supabase/migrations`. That does not authorize applying it to a hosted project.

Auth cookies stay host-only. The browser isolation check is on `qa-residential`: Quinn Example is absent from the directory, search, and the direct customer URL.
