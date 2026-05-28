# Production release v1 — cleanScheduler platform launch

## Summary

First production release of **cleanScheduler**: a multi-tenant scheduling, quoting, billing, and customer-service platform for residential and commercial cleaning businesses. This PR merges `dev` → `main` and represents the initial go-live of the full product surface across marketing, tenant operations, customer portal, and platform admin — backed by **55 Supabase migrations**, Stripe Connect, Plaid bank reconciliation, transactional SMS (sent.dm), email (Resend), Vercel cron jobs, and production-hardening fixes for build, lint, and deployment tooling.

### Platform architecture

Single Next.js 15 deployment with subdomain-based portal routing (`middleware.ts`):

| Host                          | Portal                      |
| ----------------------------- | --------------------------- |
| `cleanscheduler.com` / `www`  | Marketing + auth            |
| `admin.cleanscheduler.com`    | Founder / platform admin    |
| `my.cleanscheduler.com`       | Unified customer portal     |
| `{tenant}.cleanscheduler.com` | Tenant operations           |
| Custom domains (Pro)          | White-label customer portal |

### Major feature areas

**Marketing & onboarding**

- Public marketing site, pricing, trial signup, tenant onboarding survey
- MFA support for admin and sensitive tenant flows
- **Help Center** (`/help`) with audience hubs (customers, developers, compliance), FAQ, contact, and **TCR/SMS compliance documentation** (`/help/tcr`)

**Tenant portal**

- Dashboard, customers, properties, quotes (wizard, line items, e-sign, expiry, archival)
- Schedule (calendar, recurring visits, assignees, reschedule requests, visit proof photos)
- Billing hub: platform subscription (Starter / Business / Pro), Stripe Connect onboarding, invoices, service plans, customer subscriptions, manual payment audit, bank connection (Plaid), transactions, payment setup
- Employees, roles, compensation settings, campaigns (email)
- Reports (MRR, collections, tax, field check, reconciliation, PDF export)
- Settings: business profile, operations, locations, integrations (tenant API keys + outbound webhooks), customer portal / white-label domains (Vercel + Supabase redirect automation)
- Owner onboarding checklist, global search, entitlements / plan gates

**Customer portal**

- Invite completion with optional **transactional SMS opt-in** (TCR-ready)
- Quotes (view, accept/decline), visits, reschedule, invoices (pay via Connect Checkout), subscriptions, messages, settings

**Platform admin**

- Tenant management, inquiries, masquerade, audit log, platform stats

**Integrations**

- **Stripe** — platform subscriptions + Connect (invoice pay, customer subs, payouts, disputes, refunds, invoice mirror)
- **Plaid** — bank link, transaction sync, reconciliation
- **sent.dm** — transactional SMS (quotes, visit reminders, overdue invoices) + webhook status
- **Resend** — transactional email, portal invites, campaign delivery webhooks
- **Tenant REST API** (`/api/v1/*`) — customers, quotes, visits, invoices (Pro-gated)
- **Outbound tenant webhooks** with cron delivery retry

**Database & security**

- **55 ordered migrations** (`0001`–`0055`): multi-tenant auth, RLS, billing, scheduling, quotes, Connect mirrors, SMS, API keys, white-label domains, onboarding state, etc.
- One-shot prod baseline generator: `npm run db:prod-baseline` → `supabase/scripts/generated/prod_baseline.sql`
- RLS smoke test: `supabase/tests/rls/tenant_isolation.sql`
- Zod-validated env (`lib/env.ts`) with prod guards (live Stripe keys, `CRON_SECRET`, HTTPS Supabase URL)

**Ops & CI**

- GitHub Actions: engines, audit, typecheck, tests, format, lint, migration prefix + drift checks
- Vercel cron schedules for usage rollup, recurring visits, trials, Plaid sync, SMS reminders, invoice reminders, webhook delivery, domain verification
- Node **22.22.1+** enforced (`engine-strict`)

### Production readiness fixes (this branch)

- Fixed `react/no-unescaped-entities` on TCR help page (build blocker)
- Fixed `scripts/check-migration-drift.mjs` syntax (CI blocker)
- Cleaned ESLint warnings across tenant/billing/schedule modules
- Updated `supabase/scripts/README.md` (baseline now documents `0001`–`0055`)
- Added `.env.production` to `.gitignore`; expanded `.env.example` (`VERCEL_PROJECT_NAME`, `STRIPE_PLATFORM_PRICE_BUSINESS_SUBSCRIBE`)
- **`npm run build`** passes; migration drift check passes (55 files)

---

## Deployment prerequisites

> Environment variables are configured in **Vercel Production** (not committed). See `.env.example` for the full catalog.

### Required for prod boot

- `NEXT_PUBLIC_APP_ENV=prod`
- `NEXT_PUBLIC_APP_DOMAIN=cleanscheduler.com`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### Integrations (enable per feature)

- **Stripe**: live keys, two webhook destinations → `https://cleanscheduler.com/api/webhooks/stripe` (Your account + Connected accounts), platform price IDs, `STRIPE_CONNECT_CLIENT_ID`
- **Plaid**: `PLAID_ENV=production`, webhook → `/api/webhooks/plaid`
- **sent.dm**: API key, webhook secret, all `SENT_DM_TEMPLATE_*` vars
- **Resend**: API key, from address
- **White-label** (optional): `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`

### Supabase production database

**New empty project:**

```bash
npm run db:prod-baseline
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/generated/prod_baseline.sql
```

**Ongoing:** `supabase db push` against linked project (do **not** re-run baseline on existing schema).

**Do not run** `supabase/seed/*.sql` in production.

### Supabase Auth (Dashboard)

- Email + Google providers as needed
- Redirect URLs for apex, `admin`, `my`, tenant subdomains, and white-label portal domains (`/auth/callback`)
- MFA (TOTP) enabled for admin / bank-sensitive flows

### DNS

- Apex + `www` + `admin` + `my` + wildcard `*.cleanscheduler.com` → Vercel

---

## Test plan

### Pre-merge (CI / local)

- [ ] `npm run check:engines`
- [ ] `npm run check:migrations`
- [ ] `npm run check:migration-drift`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`

### Post-deploy smoke (production)

- [ ] Marketing homepage loads at apex
- [ ] Sign up / sign in (email + Google if enabled)
- [ ] Tenant onboarding creates workspace + subdomain portal
- [ ] Owner can complete Stripe Connect onboarding
- [ ] Create customer → send portal invite → customer completes invite (SMS opt-in optional)
- [ ] Create quote → send → customer accepts
- [ ] Schedule visit → materialize recurring (or wait for cron)
- [ ] Issue invoice → customer pays via Connect Checkout
- [ ] Stripe webhook test events succeed (platform + connected account destinations)
- [ ] `/help` and `/help/tcr` render; legal links (`/privacy`, `/sms-terms`) work
- [ ] Admin portal: list tenants, view inquiry
- [ ] Cron: confirm one `/api/cron/*` route returns 200 with `Authorization: Bearer $CRON_SECRET`

### Integrations (if enabled)

- [ ] Plaid link + webhook receipt
- [ ] sent.dm SMS send + delivery webhook
- [ ] Resend email send
- [ ] Tenant API key: `GET /api/v1/customers` with `Authorization: Bearer cs_live_…`

---

## Risks & follow-ups

| Area                      | Notes                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Migration history**     | SQL Editor / `psql` baseline does not populate `supabase_migrations.schema_migrations`; use CLI for ongoing deploys or backfill history manually |
| **Help / developer docs** | `/help/developers` cards are largely placeholders; internal `docs/` is source of truth until public API docs ship                                |
| **Resend webhook**        | `/api/webhooks/resend` accepts payloads without signature verification — consider hardening post-launch                                          |
| **RLS coverage**          | Some service-role-only tables lack RLS enablement; validate tenant isolation under realistic roles before scaling                                |
| **Secrets**               | Ensure `.env.production` stays local/gitignored; rotate any keys that were ever committed or shared                                              |

---

## Stats

- **~159 commits** (`main..dev`)
- **827 files** changed (+92k / −1.4k lines)
- **55** Supabase migrations
- **10** Vercel cron jobs

---

## Suggested merge strategy

1. Merge to `main` after CI green and prod env verified in Vercel.
2. Apply Supabase schema to production DB (baseline or `db push`).
3. Deploy Vercel production from `main`.
4. Run post-deploy smoke checklist above.
5. Monitor Stripe webhook logs, Sentry (if configured), and first cron cycle.
