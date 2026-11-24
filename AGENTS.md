<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# cleanScheduler — agent map

Read this before searching the tree. Product behavior lives in `docs/product/`. Decisions and pitfalls live in `docs/agents/`. Security model: `docs/security/iam-architecture.md`. QA: `docs/QA-BRIEF.md`. Do not paste those files into a change. Paths below exist in this repo. `README.md`, `docs/production-release-pr.md`, and `supabase/scripts/README.md` still say Next 15 and migrations through `0055`; trust this file and `package.json`.

## Product

One Next.js app for cleaning companies. An owner schedules crews, sends quotes, invoices customers, and gives those customers a branded portal. A workspace is a tenant. Residential and commercial are the same app: `tenant_operational_settings.service_segment` is `residential`, `commercial`, or `both` (`supabase/migrations/0123_tenant_service_segment_sqft_bids.sql`). Plans are Starter, Business, and Pro. There is no feature add-on catalog; the only prepaid extra is an SMS text pack (`docs/agents/plan-tier-not-addons.md`).

Four hosts, one deployment (`proxy.ts`, `lib/portal.ts`):

| Host                      | Portal                   | App tree         |
| ------------------------- | ------------------------ | ---------------- |
| `<apex>` and `www.<apex>` | Marketing and sign-in    | `app/marketing/` |
| `admin.<apex>`            | Platform staff           | `app/admin/`     |
| `my.<apex>`               | Customer portal          | `app/customer/`  |
| `<tenant-slug>.<apex>`    | Cleaning-company console | `app/tenant/`    |

Local apex is `lvh.me:3000`. Dev apex is `dev.cleanscheduler.com`. Prod apex is `cleanscheduler.com`. Pro tenants can also attach a white-label customer hostname (`tenant_customer_portal_domains`). Public booking is `/book` on the tenant host. Guest invoice pay is `/pay/[token]`. Tenant marketing pages are `/site`. Hiring applications are `/apply`.

## Stack

Declared in `package.json` and `.nvmrc` (installed versions float inside these ranges):

- Next.js `^16.4.5` App Router, React `^19.2.7`, TypeScript `^6.0.3` (`strict`, `noUncheckedIndexedAccess`). Path alias `@/*` is the repo root (`tsconfig.json`). `typedRoutes` is off (`next.config.ts`).
- Node `>=22.22.1` (`.nvmrc` is `22.22.1`). CI quality job uses the `node:22.22.1-bookworm` image.
- Supabase: `@supabase/supabase-js` `^2.110.7`, `@supabase/ssr` `^0.12.3`. Postgres, Auth, Storage. No `supabase/functions` directory. RLS is the tenant boundary.
- UI: SCSS modules plus `styles/` tokens. No Tailwind. Radix primitives, Lucide icons. Stylelint forbids stray hex (`styles/tokens/_colors.scss`).
- Zod `^4` for env and inputs (`lib/env.ts`). `rrule` `^2.8.1` for series. Stripe `^22`, Plaid `^43`, Resend `^6`, `@sentdm/sentdm` for SMS. MapLibre for the day map. Passkeys via `@simplewebauthn/*`.
- Host: Vercel. Crons in `vercel.json` hit `app/api/cron/*`. Routing engine is a separate Docker stack in `infra/routing/` (Valhalla + VROOM behind Caddy), not part of the Next process.
- Tests: Vitest `^4` (`vitest.config.ts`, `**/*.test.ts`, Node environment). Playwright `^1.61` in three configs.

Request interception is `proxy.ts` at the repo root. There is no `middleware.ts`.

## Directory map

Top level:

- `app/` — routes, colocated server actions (`actions.ts` and `*Actions.ts`), route handlers under `app/api/`.
- `components/` — shared UI. Portal chrome is `components/portal/`, `components/layout/`, `components/ui/`, `components/theme/`. Feature UI also sits next to routes.
- `lib/` — server and shared domain code. Import from here; do not grow a second utils tree.
- `styles/` — global SCSS, tokens, mixins. Feature styles are `*.module.scss` beside components.
- `supabase/migrations/` — ordered SQL. `supabase/tests/rls/` — RLS fixtures. `supabase/seed/` — local seed, not the prod baseline. `supabase/scripts/` — prod baseline builder.
- `lib/supabase/database.types.ts` — generated DB types (`npm run db:types`). Do not hand-edit.
- `lib/email/` — Resend HTML and send helpers. `lib/sms/` — sent.dm.
- `docs/product/` — what the product does. `docs/agents/` — agent notes. `docs/ops/`, `docs/security/`, `docs/billing/` — ops, IAM, plans.
- `tests/smoke/`, `tests/local-stack/`, `tests/hosted-dev/` — Playwright. Unit tests live next to source as `*.test.ts`.
- `scripts/` — migration checks, local-stack runner, hosted-dev runner, geocode backfill, one-off admin scripts.
- `infra/routing/` — self-hosted Valhalla/VROOM. `outreach/` — founder prospect lists, not runtime. `public/` — static brand and help assets. `types/` — ambient `.d.ts` only.
- `proxy.ts` — host classification and rewrite. `instrumentation.ts` — Node boot hook. `vercel.json` — www redirect and cron schedules. `.github/workflows/ci.yml` and `hosted-dev.yml`.

`app/` portals and other routes:

- `app/marketing/` — landing, pricing, help, legal, sign-in, MFA, trial, password reset, auth callback.
- `app/admin/` — tenant list, masquerade, fraud, outreach, sales pipeline, support, SEO tasks, accounting.
- `app/tenant/` — owner console: schedule, customers, quotes, billing, employees, hiring, campaigns, reports, settings.
- `app/customer/` — customer home, quotes, visits, invoices, messages, payment methods, referrals.
- `app/site/` — tenant public website. `app/book/` — booking request and instant book. `app/apply/` — hiring. `app/pay/[token]/` — guest invoice pay.
- `app/api/cron/` — scheduled jobs (Bearer `CRON_SECRET`). `app/api/webhooks/` — Stripe, Resend, sent.dm, Plaid. `app/api/v1/` — tenant REST (customers, quotes, visits, invoices). `app/api/health/` — including deployment identity.

`lib/` (one line each):

- `admin/` platform console loaders and actions. `audit/` platform and payment audit writes. `auth/` session, claims, portal gates, passkeys, MFA, masquerade handoff.
- `billing/` plans, entitlements, trials, Connect, invoices, text packs, usage. `stripe/` webhook verify and mirrors. `plaid/` bank link and sync.
- `schedule/` visits, RRULE materializer, series split, day map, reminders. `routing/` stop order and Valhalla/VROOM client. `geo/` Census then Geocodio.
- `customers/`, `customer/`, `visits/`, `booking/` — CRM, portal helpers, proof photos, instant book. `campaigns/` email campaigns. `messaging/` support threads. `sms/` transactional texts.
- `email/` all outbound mail. `outbound/` `OUTBOUND_SUPPRESSED`. `portal/` host labels, white-label domains. `tenant/`, `tenantSite/` workspace and public site.
- `hiring/`, `mileage/`, `referrals/`, `promotions/`, `reports/`, `integrations/` API keys and webhooks. `security/` access-code crypto. `hosted-dev/` deployment identity and RLS fixture guards.
- `csv/` exports. `datetime/` workspace clocks. `format/` display strings. `forms/` shared form parsing. `help/` in-app help copy. `hooks/` client hooks. `images/` avatar resize. `legal/` policy text. `marketing/` public page data. `people/` shared person fields. `performance/` portal timing. `profile/` user profile writes. `ui/` class-name helpers.
- `lib/supabase/server.ts` — `createClient` (anon, cookies), `createAdminClient` (service role), `createTenantPortalDbClient` (service role alias for portal reads). `lib/supabase/browser.ts` — browser anon client.
- `lib/env.ts` — Zod parse of public vs server env. Fails at first access, not at import time on the client.

`components/` (shared; many screens still colocate under `app/`):

- `layout/` stack, cluster, grid. `ui/` buttons, cards, dialogs. `theme/` theme script and toggle (cookie stays host-scoped; see `components/theme/themeScript.ts`).
- `portal/` shell, sidebar, top bar. `auth/` sign-in widgets. `admin/` platform widgets. `tenant/` and `tenantSite/` workspace and public-site blocks.
- `schedule/`, `visits/`, `billing/`, `customer/`, `marketing/`, `messaging/`, `legal/`, `performance/`.

Server actions are not centralized. Start in the route folder (`app/tenant/schedule/actions.ts`, `app/tenant/quotes/actions.ts`, `app/tenant/billing/actions.ts`, `app/tenant/customers/actions.ts`). Platform actions live under `lib/admin/*Actions.ts` and are called from `app/admin/`.

## Multi-tenancy and auth

`proxy.ts` takes one subdomain label (`lib/portal/platformHostLabel.ts`). `admin.evil.<apex>` is not admin. Reserved labels (`admin`, `my`, `www`, `api`, `dev`, …) are not tenant slugs. The proxy rewrites internally to `/admin`, `/customer`, `/tenant`, `/marketing`, or `/site` and sets `x-portal` and `x-tenant-slug`. The browser URL stays on the original host. `getPortalContext()` in `lib/portal.ts` reads those headers.

Session: `@supabase/ssr` in `proxy.ts` calls `getUser()` and writes refreshed cookies on the response. Cookies stay on the host that set them. Layouts call `requirePortalAccess` (`lib/auth/portalAccess.ts`) and, for a workspace, `requireTenantPortalAccess` (`lib/auth/tenantAccess.ts`). Sign-in, callback, and post-login live under `app/marketing/sign-in/`, `app/marketing/auth/callback/route.ts`, `lib/auth/resolvePostLoginDestination.ts`.

Roles:

- Platform `app_metadata.app_role`: `super_admin`, `admin`, `sales`, `employee`, `customer` (`lib/auth/types.ts`, `lib/auth/platformRoles.ts`). `admin` and `super_admin` are staff. `sales` is the pipeline/outreach console only. Workspace owners are `employee` at the platform layer.
- Workspace authority is `tenant_memberships.role`: `owner`, `admin`, `employee`, `viewer`. Custom roles: `tenant_roles` and `tenant_role_permissions`. Field-crew path limits: `lib/tenant/fieldEmployeeAccess.ts`.
- JWT `tenant_role` and `current_tenant_id` are hints. Post-login prefers the membership row for the current host (`docs/security/iam-architecture.md`).

Hard rules:

- Claims `app_role`, `tenant_role`, `current_tenant_id`, and `masquerade_target_tenant_id` come only from `app_metadata`. `extractClaims` does not read `user_metadata`. The signed-in user can edit `user_metadata`. Postgres `current_tenant_id()` and `current_app_role()` read `auth.jwt() -> app_metadata` only. See `docs/agents/tenant-claims-user-metadata.md`.
- Do not widen the auth cookie domain to a parent. A session on `admin.<apex>` is not sent to `<slug>.<apex>`. Support entry is a one-time hashed handoff at `app/tenant/auth/masquerade-handoff/route.ts` (`lib/auth/masqueradeHandoff.ts`). Direct tenant reads also need a live `masquerade_sessions` row (`has_live_support_session`, migration `0126_support_session_tenant_rls.sql`).
- Do not weaken `platformAdminFixtureBlock` in `lib/hosted-dev/rlsAssertions.ts`. It rejects a fixture access token whose JWT is platform admin or the service role before a cross-tenant query runs.

RLS: policies use `has_tenant_membership()`, `is_platform_admin()`, `has_live_support_session()`, and `can_read_hiring_desk()` (migrations `0001`, `0125`, `0126`). `authenticated` is not granted `SELECT` on `tenant_memberships` (the helper is security definer; a table grant would recurse). Smoke SQL: `supabase/tests/rls/` (nine files). `hosted_dev_cross_tenant.sql` runs only in the isolated hosted-dev job.

Service role (`createAdminClient`, `SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS. Use it only after an authorization check, and scope tenant queries by `membership.tenantId`:

- Webhooks, cron, and the recurring materializer (no user JWT).
- Platform admin loaders.
- `createTenantPortalDbClient()` for tenant Server Components. The cookie client often does not present a JWT PostgREST will use for `auth.uid()`, so RLS hides every row while service-role writes still succeed (`lib/supabase/server.ts`). That alias is intentional. Do not "fix" portal pages by dropping the tenant id filter.

`lib/auth/syncTenantClaimsFromMemberships.ts` patches only `current_tenant_id` and `tenant_role` on `app_metadata`. It does not write `user_metadata` or `app_role`. Concurrent membership edits retry; see `docs/agents/tenant-claim-sync-race.md`.

## Data model

Migrations are `supabase/migrations/0001_*.sql` through `0135_*.sql` (135 files, lexicographic order). They are applied by a person to hosted dev and prod (`psql` or the SQL editor, or `npm run db:prod-baseline` only on an empty database). Local-stack CI applies them to a disposable database. Agents do not run `supabase db push`, the Supabase MCP `apply_migration`, or any remote SQL. A new migration ships in git first; the hosted database does not update itself.

Regenerate types after a migration is applied: `npm run db:types` writes `lib/supabase/database.types.ts`.

Core rows (later migrations alter these):

- `user_profiles` belongs to one Auth user. `tenants` is the workspace. `tenant_memberships` joins a user to a tenant with `role` (`0001`).
- `customer_identities` is the login for a household or account. `customers` is the book of business. `customer_tenant_links` attaches an identity to a tenant. `tenant_customer_profiles` and `tenant_customer_properties` are that tenant's copy of the person and the service address (geocode columns live on the property).
- `tenant_quotes`, `tenant_quote_line_items`, acceptance snapshots and e-sign rows. Create/save RPC: `tenant_quote_create_with_line_items`, `tenant_quote_save_with_line_items` (latest body in `0123`, pipeline stage in `0103`).
- `tenant_scheduled_visits`, `tenant_scheduled_visit_assignees`, `recurring_appointment_rules`, `recurring_appointment_occurrence_skips`.
- `tenant_invoices`, `tenant_invoice_payments`, Stripe mirrors (`tenant_stripe_refunds`, disputes, payouts). Guest pay tokens: `tenant_invoice_pay_tokens`.
- `tenant_billing_accounts` (plan, trial, Stripe subscription status), `tenant_stripe_connect_accounts`, `service_plans`, `customer_subscriptions`.
- `tenant_operational_settings` (timezone, segment, auth policy). `tenant_roles` / `tenant_role_permissions`.
- Support and staff: `masquerade_sessions`, `masquerade_handoff_tokens`, `audit_log_entries`, `customer_support_threads`.

Other clusters: email campaigns and suppressions; promotions and wallets; referrals; hiring desk; mileage; instant booking; service zones; marketing site; platform outreach and sales pipeline; passkeys; text-pack ledger (`0131`); route bases and applied routes (`0134`). Quote create idempotency is `tenant_quote_create_requests` (`0127`) and `claim_quote_channel_send` (`0128`). Dispatch apply is `apply_cleaner_dispatch` (`0133`).

Helpers agents hit often: `current_tenant_id()`, `current_app_role()`, `is_platform_admin()`, `has_tenant_membership()`, `has_live_support_session()`, `expire_sent_quotes_past_valid_until()`, `apply_tenant_invoice_payment()`, `hold_instant_booking()` / `finalize_instant_booking()`, `consume_text_pack_segments()` / `reserve_sms_segments()`.

## Core flows

Scheduling. UI: `app/tenant/schedule/` (`actions.ts`, `page.tsx`, `[id]/`). Visits are `tenant_scheduled_visits`. Series rules are `recurring_appointment_rules` (`app/tenant/schedule/recurring/actions.ts`). Daily job `app/api/cron/materialize-recurring-visits/route.ts` calls `materializeRecurringVisitsForAllTenants` in `lib/schedule/recurringVisitMaterialize.ts`. It inserts occurrences inside `horizon_days` (default 60, max 120) and treats unique `(recurring_rule_id, starts_at)` violations as already materialized. It does not send email. Editing a visit that has `recurring_rule_id` opens `app/tenant/schedule/RecurringEditScopeDialog.tsx` (`edit_scope` = `occurrence` or `future`). Future edits call `applyRecurringSeriesEdit` → `commitRecurringSeriesSplit` (`lib/schedule/applyRecurringSeriesEdit.ts`, plan in `lib/schedule/recurringSeriesSplit.ts`). Occurrence edits stay on the one visit and record a skip. Customer mail is `lib/email/recurringSeriesNotifications.ts` after the write succeeds. Notes: `docs/product/recurring-series-email.md`, `docs/agents/recurring-series-email.md`.

Routing. `lib/routing/engineConfig.ts` reads `ROUTING_ENGINE_URL` and `ROUTING_ENGINE_TOKEN` (server-only). `lib/routing/engineOptimizer.ts` calls the Valhalla matrix and VROOM solve. Timeout default 3000 ms (`ROUTING_ENGINE_TIMEOUT_MS`, 200–8000). If the URL is unset, the call is slow, the engine errors, or outbound is suppressed, `lib/routing/haversineOptimizer.ts` keeps straight-line order. UI actions: `app/tenant/schedule/stopOrderActions.ts`, `dispatchActions.ts`, `app/tenant/schedule/map/`. Entitlement flags (`dayMap`, `singleCleanerStopOrdering`, `multiCleanerDispatch`, `routeReoptimization`, `multipleStartLocations`, `driveTimeReports`): `lib/billing/entitlements.ts` and `docs/agents/routing-entitlements.md`. Engine ops: `docs/ops/routing-engine.md`, `infra/routing/README.md`.

Geocoding. `lib/geo/censusProvider.ts` first (US Census, no key). `lib/geo/geocodioProvider.ts` only when Census misses or fails and `GEOCODIO_API_KEY` is set. Persist with `lib/geo/savePropertyGeocode.ts`. Backfill: `npm run geocode:backfill` (`lib/geo/backfillPropertyGeocodes.ts`). Google and Mapbox are not used for stored points. Day-map tiles: `NEXT_PUBLIC_MAP_STYLE_URL` (public style URL, no key). `docs/product/address-geocoding.md`, `docs/agents/address-geocoding.md`.

Quotes. `app/tenant/quotes/actions.ts` calls `tenant_quote_create_with_line_items`. After a quote id exists, later steps (location facts, entry codes, email, SMS, webhook) are warnings, not a rolled-back create. Idempotency needs migrations `0127` and `0128` applied or the action fails closed. `docs/agents/quote-create-partial-save.md`, `docs/product/quotes-line-items.md`.

Invoicing. Tenant screens under `app/tenant/billing/` (`actions.ts`, `invoiceCheckoutActions.ts`, `invoiceEmailActions.ts`, `service-plans/actions.ts`). PDF: `lib/billing/renderInvoicePdf.ts`. Guest pay: `app/pay/[token]/` and `lib/billing/invoicePayToken.ts`. Connect Checkout uses the tenant's connected account (`lib/billing/stripeConnectServer.ts`).

Stripe billing. Platform subscription prices resolve in `lib/billing/platformPlans.ts` (monthly, then yearly, then legacy `STRIPE_PLATFORM_PRICE_*`). Checkout: `lib/billing/platformCheckout.ts`. Webhook: `app/api/webhooks/stripe/route.ts` → `lib/stripe/handleStripeWebhook.ts` (platform secret vs Connect secret). Entitlement source of truth: `lib/billing/entitlements.ts`. Gates: `lib/billing/tenantFeatureGate.ts`, `requireFeature.ts`. Trial expiry cron: `app/api/cron/expire-stale-trials/route.ts`. Text packs: `lib/billing/textPackCheckout.ts`, `docs/agents/text-packs.md`. `docs/billing/tier-entitlements.md`.

Email and SMS. Send path: `lib/email/resend.ts` (`sendTransactionalEmail`) and `lib/sms/sendTransactionalSms.ts`. Brand: `lib/email/emailBrand.ts`. Visit reminders (email and SMS, about 23–25 hours out): `lib/schedule/visitReminders.ts`, cron `app/api/cron/visit-reminders/route.ts`. `app/api/cron/visit-sms-reminders/route.ts` is the same handler, kept as an alias; `vercel.json` schedules `visit-reminders` only. Invoice reminders: `lib/billing/invoiceReminders.ts`. `OUTBOUND_SUPPRESSED=1` returns before a provider client is built (`lib/outbound/suppression.ts`). It also skips Stripe, Plaid, customer webhooks, and the routing engine. It cannot turn on when `VERCEL_ENV=production`. `docs/ops/outbound-suppression.md`.

Customer portal. Routes in `app/customer/`. Invites: table `customer_portal_invites` and `app/customer/complete-invite/`. White-label host registration: `lib/portal/vercelProjectDomains.ts` and `app/api/cron/verify-customer-portal-domains/route.ts`. Messages: `app/customer/messages/` and `app/tenant/messages/actions.ts`. Tenant REST is `app/api/v1/` (Pro, hashed keys in `tenant_api_keys`). Outbound webhooks retry on `app/api/cron/deliver-tenant-webhooks/route.ts`.

Scheduled routes in `vercel.json` (all require `Authorization: Bearer CRON_SECRET`; missing secret returns 501):

| Path                                                   | Schedule      |
| ------------------------------------------------------ | ------------- |
| `app/api/cron/usage-rollup/route.ts`                   | `0 5 * * *`   |
| `app/api/cron/materialize-recurring-visits/route.ts`   | `0 6 * * *`   |
| `app/api/cron/expire-stale-trials/route.ts`            | `15 7 * * *`  |
| `app/api/cron/purge-unconverted-trials/route.ts`       | `30 7 * * *`  |
| `app/api/cron/purge-canceled-tenants/route.ts`         | `45 7 * * *`  |
| `app/api/cron/backfill-stripe-payout-links/route.ts`   | `30 8 * * 0`  |
| `app/api/cron/plaid-sync/route.ts`                     | `0 9 * * *`   |
| `app/api/cron/visit-reminders/route.ts`                | `0 10 * * *`  |
| `app/api/cron/deliver-tenant-webhooks/route.ts`        | `*/5 * * * *` |
| `app/api/cron/invoice-reminders/route.ts`              | `0 11 * * *`  |
| `app/api/cron/outreach-send/route.ts`                  | `* * * * *`   |
| `app/api/cron/verify-customer-portal-domains/route.ts` | `*/5 * * * *` |
| `app/api/cron/hiring-desk/route.ts`                    | `*/5 * * * *` |

`app/api/cron/visit-sms-reminders/route.ts` is not in that list. It calls the same `sendVisitRemindersForAllTenants` as `visit-reminders`.

## Environments

`dev` branch deploys to `https://dev.cleanscheduler.com` (and `admin.`, `my.`, `<slug>.`). `main` deploys to `https://cleanscheduler.com`. `NEXT_PUBLIC_APP_ENV` is `local`, `dev`, or `prod` (`lib/env.ts`). Prod requires `https://` Supabase URL, `CRON_SECRET`, live Stripe secret (`sk_live_`) when `STRIPE_SECRET_KEY` is set, and `PLAID_ENV=production` when `PLAID_SECRET` is set. Any other app env rejects `sk_live_`. `SUPABASE_DISALLOW_PROJECT_REF` blocks `local` and `dev` when that substring appears in `NEXT_PUBLIC_SUPABASE_URL`. Hosted dev sets `OUTBOUND_SUPPRESSED=1`. Plaid default when unset is sandbox (`lib/plaid/plaidEnv.ts`). `.env.example` is safe to copy for `npm run build`; blank `NEXT_PUBLIC_SENTRY_DSN` and `RESEND_FROM_EMAIL` count as unset.

Names only. Schema is `lib/env.ts` unless noted.

- App: `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_DOMAIN`, `NODE_ENV`.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DISALLOW_PROJECT_REF`.
- Stripe: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_APPLICATION_FEE_BPS`, `STRIPE_CONNECT_BILLING_PORTAL_CONFIGURATION_ID`, `STRIPE_PLATFORM_PRICE_ID`, `STRIPE_PLATFORM_PRICE_STARTER`, `STRIPE_PLATFORM_PRICE_PRO`, `STRIPE_PLATFORM_PRICE_BUSINESS`, the `_MONTHLY` / `_YEARLY` / `_SUBSCRIBE` variants of those three tiers, `STRIPE_PRICE_TEXT_PACK_1000`, `STRIPE_PRICE_TEXT_PACK_2500`. Sandbox keys on local and dev. Live keys only when `NEXT_PUBLIC_APP_ENV=prod`.
- Plaid: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox`, `development`, `production`), `PLAID_WEBHOOK_URL`, `PLAID_WEBHOOK_VERIFY` (read outside the Zod object).
- Email and SMS: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `RESEND_CUSTOMER_INVITE_TEMPLATE_ID`, `SENT_DM_API_KEY`, `SENT_WEBHOOK_SECRET`, `SENT_DM_TEMPLATE_QUOTE_SENT`, `SENT_DM_TEMPLATE_QUOTE_ACCEPTED`, `SENT_DM_TEMPLATE_QUOTE_DECLINED`, `SENT_DM_TEMPLATE_VISIT_REMINDER`, `SENT_DM_TEMPLATE_INVOICE_OVERDUE`, `SENT_DM_TEMPLATE_HIRING_SLOT_OFFERED`, `SENT_DM_TEMPLATE_HIRING_REMINDER`, `SENT_DM_TEMPLATE_HIRING_SLOT_CANCELED`, `ONBOARDING_EMAIL_CONFIRM_MODE`.
- Maps and routing: `GEOCODIO_API_KEY`, `CENSUS_GEOCODE_URL` (local-stack loopback stub only), `NEXT_PUBLIC_MAP_STYLE_URL`, `MAPRICOT_API_KEY`, `ROUTING_ENGINE_URL`, `ROUTING_ENGINE_TOKEN`, `ROUTING_ENGINE_TIMEOUT_MS`.
- Safety switches: `OUTBOUND_SUPPRESSED`, `CRON_SECRET`, `PROPERTY_ACCESS_CODE_KEY`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Vercel domain API: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_PROJECT_NAME`, `VERCEL_TEAM_ID`, `VERCEL_DOMAIN_GIT_BRANCH`, `VERCEL_DOMAIN_CUSTOM_ENVIRONMENT_ID`. `VERCEL_ENV` is set by the platform.
- Observability: `NEXT_PUBLIC_SENTRY_DSN`, `DEBUG_PERF`, `NEXT_PUBLIC_PORTAL_PERF_LOG`, `NEXT_PUBLIC_PORTAL_PERF_ENDPOINT`.
- QA only (not product runtime): `DATABASE_URL`, `RLS_SMOKE_REQUIRED`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_BOOKING_URL`, `HOSTED_DEV_BASE_URL`, `HOSTED_DEV_EXPECT_SHA`, `HOSTED_DEV_DENY_SUPABASE_PROJECT_REF`, `HOSTED_DEV_REQUIRE_IDENTITY`, `HOSTED_DEV_ISOLATED`, `HOSTED_DEV_MUTATIONS`, `HOSTED_DEV_MUTATIONS_CONFIRMED`, `HOSTED_DEV_BOOKING_URL`, `QA_DEV_DATABASE_URL`, `LOCAL_STACK_PG_PORT`, `LOCAL_STACK_REUSE_SERVER`, `GEOCODE_STUB_PORT`, `MARKETING_SCREENSHOT_TENANT_SLUG`, `MARKETING_SCREENSHOT_EMAIL`, `MARKETING_SCREENSHOT_PASSWORD`, `MARKETING_SCREENSHOT_BASE_URL`. `CONFIRM_PLATFORM_ADMIN_DEMOTION` and `PLATFORM_STAFF_ALLOWLIST` gate `scripts/demote-mislabeled-platform-admins.mts`.

## Testing

- Unit: `npm run test` (Vitest). No secrets. This is what CI `quality` runs, plus `npm run typecheck`, `npm run format:check`, `npm run check:migrations`, `npm run check:migration-drift`, `npm run lint`, `npm run lint:styles`, and `npm audit --omit=dev --audit-level=high`. `quality` does not build or run Playwright. Dependency review runs only on `pull_request`.
- Smoke (no sign-in): `npm run test:e2e` (`playwright.smoke.config.ts`, `tests/smoke`). Not a CI job. `PLAYWRIGHT_BASE_URL` defaults to `http://127.0.0.1:3000`. In CI the config starts `npm run start`, so build first.
- Local stack: `npm run test:local-stack` (`.github/workflows/ci.yml` job `local-stack`, 45 minutes). Disposable Supabase from this branch's migrations, six seeded workspaces in `scripts/local-stack/qa-accounts.json` (`qa-residential`, `qa-commercial`, `qa-pro`, `qa-trial`, `qa-past-due`, `qa-paused` on `*.lvh.me`). Emails are `@example.test`. Runs RLS SQL with `RLS_SMOKE_REQUIRED=1`, then authenticated Playwright (`playwright.local-stack.config.ts`), then geocode backfill against `127.0.0.1:5499`. No GitHub secrets. Without Docker the command exits 1. `--postgres-fallback` applies SQL on loopback Postgres and does not run the browser. `npm run check:rls-smoke` exits 0 and skips when `DATABASE_URL` is unset; that skip is not a pass. `docs/ops/local-stack.md`.
- Hosted dev: `npm run test:hosted-dev` against `https://dev.cleanscheduler.com` only. Isolated reads and cross-tenant RLS: `HOSTED_DEV_ISOLATED=1 npm run test:hosted-dev:isolated`. QA tenant names are secrets on the GitHub environment `hosted-dev-isolated`, not repository secrets. Do not create accounts. `docs/ops/hosted-dev-tests.md`.
- CI jobs that do not run on a normal PR: `hosted-dev.yml` (deployment_status for Vercel env `dev`, or workflow_dispatch from `main`). The `hosted-dev-isolated` job also needs `vars.HOSTED_DEV_ISOLATED == '1'` and the workflow file from `main`. Agents do not dispatch it, do not set `HOSTED_DEV_ISOLATED`, and do not add `dev` to that environment's branch policy. There is no required `npm run build` job; build locally when the change can break compilation.

Docs-only changes: `quality` on the PR is the bar (`docs/QA-BRIEF.md`).

## Workflow

Branch from `dev`. Open the pull request into `dev`. Squash-merge. Production is a separate pull request onto `main` that cherry-picks the squash commit. `dev` serves dev.cleanscheduler.com. `main` serves cleanscheduler.com. Do not merge `dev` into `main` as the release. `.cursor/rules/confirm-ship.mdc` still asks a person before committing; this map does not override that ask.

After a behavior change, add a short note in `docs/agents/` (what was decided, which file, which pitfall) and update `docs/product/` when the user-visible story changed. Link those notes. Do not copy them into this file. Pre-ship commands are `.cursor/rules/pre-ship-checks.mdc`: `npm run format`, `npm run lint`, `npm run lint:styles`, and for app code also `typecheck`, `test`, and `build`.

Cursor process rules (`.cursor/rules/*.mdc`) and `CLAUDE.md` point here. They do not restate this map.

## Gotchas

- Series split is not one database transaction. `commitRecurringSeriesSplit` inserts the new rule, updates visits and crew, writes skips, then closes the old rule. A later failure runs an undo. If the undo fails, that text is appended to the error. Completed, checked-in, and invoiced visits are left in place.
- The materializer expands RRULEs in UTC. `seriesOccurrenceStarts` uses `rrulestr(..., { tzid: 'UTC' })`. Weekly instances that are not on the calendar yet can shift an hour across DST. "This and future" matches already-saved visits by workspace-local weekday and clock so a 9:00 AM visit stays put. Monthly clamps 29–31 to the last day of the month at the anchor's UTC clock (`lib/schedule/recurringSeriesSplit.ts`).
- Quote create does not roll back after the RPC returns an id. Entry-code encryption needs `PROPERTY_ACCESS_CODE_KEY`. Missing `0127` / `0128` fails closed instead of inserting. Do not resume from a client-supplied previous quote id (`docs/agents/quote-create-partial-save.md`).
- `createClient()` and `createTenantPortalDbClient()` are different. Portal UI that "sees no rows" is often the cookie client, not an empty table. Service-role reads must still filter `tenant_id`.
- `user_metadata` is not a hint. Do not route, authorize, or stamp tenant id from it.
- Do not set a cookie `domain` of `.cleanscheduler.com` or `.lvh.me`. Masquerade must stay a handoff.
- `platformAdminFixtureBlock` is a test guard, not something to bypass when a fixture user was wrongly marked platform admin. Fix the fixture.
- `OUTBOUND_SUPPRESSED` on the test runner does not open hosted-dev writes. The deployment must report `outboundSuppressed: true` from `GET /api/health/deployment`. Production refuses the flag.
- `vercel.json` does not schedule `visit-sms-reminders`. That route is an alias of `visit-reminders`, which sends both channels.
- `npm run check:rls-smoke` with no `DATABASE_URL` is a skip. `test:local-stack` without Docker is a failure, not a skipped pass.
- Google geocode helpers under `lib/geo/googleGeocode.ts` build map links. They do not persist coordinates.
- `UpgradeOrAddOnModal` is a file name only. The dialog upgrades the plan. Do not add a `tenant_addons` table (`docs/agents/plan-tier-not-addons.md`).
- Next.js rewrites the top block of this file when `next dev` runs. Keep that block. Put map edits below it.

## Where to look first

| Task                             | Start                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Host / portal wrong              | `proxy.ts`, `lib/portal.ts`, `lib/portal/platformHostLabel.ts`                                                                    |
| Sign-in, redirect, MFA, passkeys | `lib/auth/session.ts`, `lib/auth/resolvePostLoginDestination.ts`, `app/marketing/sign-in/`, `lib/auth/enforceTenantAuthPolicy.ts` |
| Who can open this page           | `lib/auth/portalAccess.ts`, `lib/auth/tenantAccess.ts`, `lib/auth/tenantRoleAccess.ts`                                            |
| Claims or membership sync        | `lib/auth/types.ts`, `lib/auth/syncTenantClaimsFromMemberships.ts`                                                                |
| Masquerade                       | `lib/admin/masqueradeActions.ts`, `lib/auth/masqueradeHandoff.ts`, `app/tenant/auth/masquerade-handoff/route.ts`                  |
| New visit or series              | `app/tenant/schedule/actions.ts`, `app/tenant/schedule/recurring/actions.ts`                                                      |
| Edit one visit vs rest of series | `app/tenant/schedule/RecurringEditScopeDialog.tsx`, `lib/schedule/applyRecurringSeriesEdit.ts`                                    |
| Why a visit did not appear       | `lib/schedule/recurringVisitMaterialize.ts`, `app/api/cron/materialize-recurring-visits/route.ts`                                 |
| Stop order, dispatch, drive time | `lib/routing/`, `app/tenant/schedule/stopOrderActions.ts`, `app/tenant/schedule/dispatchActions.ts`                               |
| Day map pins                     | `lib/schedule/dayMap.ts`, `lib/schedule/loadDayMap.ts`, `app/tenant/schedule/map/page.tsx`                                        |
| Address coordinates              | `lib/geo/ensurePropertyGeocoded.ts`, `lib/geo/censusProvider.ts`                                                                  |
| Quote wizard                     | `app/tenant/quotes/actions.ts`, `docs/agents/quote-create-partial-save.md`                                                        |
| Invoice, Connect, guest pay      | `app/tenant/billing/`, `lib/stripe/handleStripeWebhook.ts`, `app/pay/[token]/`                                                    |
| Plan gate or trial               | `lib/billing/entitlements.ts`, `lib/billing/tenantFeatureGate.ts`, `lib/billing/trial.ts`                                         |
| Email or SMS not sent            | `lib/email/resend.ts`, `lib/sms/sendTransactionalSms.ts`, `lib/outbound/suppression.ts`                                           |
| Customer cannot see a quote      | `app/customer/`, `customer_portal_invites`, RLS in `supabase/tests/rls/tenant_quotes_member_read.sql`                             |
| White-label domain               | `app/tenant/settings/customer-portal/actions.ts`, `lib/portal/vercelProjectDomains.ts`                                            |
| Public booking                   | `app/book/`, `lib/booking/`                                                                                                       |
| Schema change                    | `supabase/migrations/`, then types. Do not apply remotely from an agent                                                           |
| Env name                         | `lib/env.ts`, `.env.example`                                                                                                      |
| How to test                      | `docs/QA-BRIEF.md`, `docs/ops/local-stack.md`, `docs/ops/hosted-dev-tests.md`                                                     |
| Instant book                     | `app/book/instantActions.ts`, `lib/booking/`, RPCs `hold_instant_booking` and `finalize_instant_booking`                          |
| Hiring desk                      | `app/tenant/hiring/actions.ts`, `app/apply/[slug]/actions.ts`, `app/api/cron/hiring-desk/route.ts`                                |
| Reports                          | `app/tenant/reports/`, `lib/reports/`                                                                                             |
| Employee invite and roles        | `app/tenant/employees/employeeInviteActions.ts`, `app/tenant/settings/roles/actions.ts`                                           |
| Workspace settings               | `app/tenant/settings/` (`business/businessActions.ts`, `operations/`, `security/actions.ts`, `integrations/actions.ts`)           |
| Campaign email                   | `app/tenant/campaigns/campaignActions.ts`, `lib/email/sendCampaignEmail.ts`, `app/api/webhooks/resend/route.ts`                   |
| Plaid reconciliation             | `app/tenant/billing/bank-connection/actions.ts`, `lib/plaid/server.ts`, `app/api/webhooks/plaid/route.ts`                         |
| Platform outreach                | `lib/admin/outreachActions.ts`, `app/admin/outreach/`, `app/api/cron/outreach-send/route.ts`                                      |

Deeper agent notes (read the one that matches; do not load the folder): `docs/agents/address-geocoding.md`, `cleaner-schedule-email.md`, `day-map.md`, `dispatch.md`, `hosted-dev-psql-env.md`, `local-qa-stack.md`, `next-16-4-5-security.md`, `no-add-ons-page.md`, `plan-tier-not-addons.md`, `pro-routing.md`, `quote-create-partial-save.md`, `recurring-series-email.md`, `routing-engine.md`, `routing-entitlements.md`, `stop-order.md`, `tenant-claim-sync-race.md`, `tenant-claims-user-metadata.md`, `text-packs.md`, `transactional-email-gaps.md`.

## Do not

- Do not apply or edit hosted SQL from an agent. Add a file under `supabase/migrations/` and stop.
- Do not put secrets, tenant slugs, or customer emails in docs, logs, or this file.
- Do not add `middleware.ts`. Host routing is `proxy.ts`.
- Do not introduce Tailwind, a second component kit, or a `tenant_addons` table.
- Do not read `user_metadata` for authorization. Do not set a parent cookie domain. Do not weaken `platformAdminFixtureBlock`.
- Do not dispatch `.github/workflows/hosted-dev.yml` or set `HOSTED_DEV_ISOLATED`.
- Do not treat `README.md` as the version source. Next is 16, migrations run through `0135`.
