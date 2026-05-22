# Tier Entitlements: Build Contract

This file defines the canonical entitlement payload and API/server-action checks
for `Starter`, `Business`, and `Pro`.

## Canonical shape

Use `lib/billing/entitlements.ts` as the source of truth.

```ts
type EntitlementFeature =
  | 'rolePermissions'
  | 'jobCosting'
  | 'customerPortal'
  | 'campaigns'
  | 'advancedAnalytics'
  | 'salesTaxSummary'
  | 'payrollExports'
  | 'forecasting'
  | 'fullApiWebhooks'
  | 'multiLocationControls'
  | 'dedicatedOnboarding'
  | 'plaidReconciliation'
  | 'smsCommunication';

type EntitlementLimitKey =
  | 'includedOfficeSeats'
  | 'includedFieldSeats'
  | 'maxActiveCustomers'
  | 'maxAutomationWorkflows'
  | 'includedSmsCreditsMonthly'
  | 'includedEmailCreditsMonthly'
  | 'includedIntegrations'
  | 'maxCampaignSendsMonthly'
  | 'maxConcurrentActiveCampaigns'
  | 'maxCampaignAudienceSize'
  | 'maxCampaignDrafts';

interface PlanEntitlements {
  plan: 'starter' | 'business' | 'pro';
  displayName: string;
  monthlyPriceUsd: number; // 39, 129, 299
  annualEffectiveMonthlyUsd: number; // 31, 103, 239
  features: Record<EntitlementFeature, boolean>;
  limits: Record<EntitlementLimitKey, number> & {
    /** `null` = unlimited field seats (Pro). */
    includedFieldSeats: number | null;
  };
}
```

## Price points

- Starter: `$39/mo` (`$31` annual-effective)
- Business: `$129/mo` (`$103` annual-effective)
- Pro: `$299/mo` (`$239` annual-effective)

## Team seats (office vs field)

Office seats count **owner**, **admin**, and **viewer** logins. Field seats count **employee** logins only.

| Tier | Office seats | Field seats |
| ---- | ------------ | ----------- |
| Starter | 1 | 3 |
| Business | 2 | 10 |
| Pro | 10 | Unlimited |

Implementation: `lib/billing/teamSeats.ts` (`countTeamSeatUsage`, `assertCanAssignTeamSeat`).

Enforcement (active memberships + pending invites):

- `app/tenant/employees/employeeInviteActions.ts` — before creating an invite
- `app/tenant/employees/employeeMemberActions.ts` — role changes and reactivation
- `app/marketing/complete-employee-invite/actions.ts` — before accepting an invite

Inactive members do not consume seats. Pending invites reserve a seat until accepted, expired, or revoked.

## SMS (Pro — planned send pipeline)

| Tier | `smsCommunication` | `includedSmsCreditsMonthly` |
| ---- | -------------------- | --------------------------- |
| Starter | No | 0 |
| Business | No | 0 |
| Pro | Yes | 25,000 |

Entitlement flag is defined and enforced at send time. Requires Twilio env vars on the server.
**Not available during the free trial** — tenant billing status must be `active` or `past_due` (see `canUseSmsCommunication` in `lib/billing/tenantSubscriptionAccess.ts`).

**Implemented (Pro + Twilio configured):**

- Quote SMS (customer sent; team accept/decline) — `lib/sms/quoteNotificationSms.ts`
- Visit reminder SMS (~24h before) — daily cron `/api/cron/visit-sms-reminders`
- Metering via `tenant_sms_messages.segment_count` — `lib/billing/smsCredits.ts`
- Settings toggles — Settings → Operations (Pro only)

**Not yet built:** SMS marketing campaigns, inbound/two-way SMS.

## Required API/server-action checks

### 1) Hard gates (feature flags)

Before premium operations run, call `assertFeatureEnabled(planTier, feature)`.

Recommended first checks to implement:

- API integrations / webhooks endpoints -> `fullApiWebhooks`
- analytics/reporting endpoints -> `advancedAnalytics` (Phase 1.5 tenant reports: reconciliation, revenue breakdowns, MRR, employee performance — see `docs/product/tenant-reports.md`)
- forecast endpoints -> `forecasting`
- onboarding concierge flows -> `dedicatedOnboarding`
- multi-location management routes -> `multiLocationControls`
- `/campaigns` routes and campaign send actions -> `campaigns`

### Tenant Reports (implemented — see `docs/product/tenant-reports.md`)

| Reports capability | Starter | Business | Pro |
|--------------------|---------|----------|-----|
| Hub + Phase 1 core (AR aging, invoice audit, field checks read-only, collections, quote pipeline) | Yes | Yes | Yes |
| CSV/PDF export (all implemented report slugs) | Yes | Yes | Yes |
| Phase 1.5 analytics (reconciliation, revenue by customer/service, MRR, employee performance) | No | No | Yes (`advancedAnalytics`) |
| Sales tax summary | No | Yes (`salesTaxSummary`) | Yes |
| Payroll export report (generic + ADP/Gusto/QBO CSV) | No | Yes (`payrollExports`) | Yes |
| Tips & commissions (rules directory) | No | Yes (`jobCosting`) | Yes |
| Crew utilization + on-time arrival | No | No | Yes (`advancedAnalytics`) |
| Cohort / LTV (Phase 3) | No | No | Yes (`forecasting`) |

Enforcement:

- `lib/reports/reportCatalog.ts` — per-report `ReportGate`
- Pages: `app/tenant/reports/*` — `isReportEnabled(tier, slug)` on hub cards and `/reports/[slug]`
- Exports: `isReportEnabled` on `app/api/tenant/reports/export` and `export/pdf`
- **Reports nav stays visible** on all tiers (unlike campaigns); locked reports show upgrade panel → `/billing`
- Cache: `report_runs` via service role (`lib/reports/reportRunCache.ts`, migration `0034_report_runs.sql`)

### Email campaigns (implemented)

See `docs/product/email-campaigns.md`.

- `app/tenant/campaigns/*` — `assertFeatureEnabled(tier, 'campaigns')` on pages and actions
- Before send: `maxCampaignSendsMonthly`, `includedEmailCreditsMonthly`, `maxCampaignAudienceSize`, `maxConcurrentActiveCampaigns`
- Marketing sends only; transactional Resend mail is not metered

### 2) Soft limits (metered caps)

Before creating or triggering resource-heavy actions, call:

`assertLimitNotExceeded(planTier, limitKey, currentValue)`

Current implementation:

- `app/tenant/customers/actions.ts`
  - checks `maxActiveCustomers` before creating a customer
- `app/tenant/campaigns/campaignActions.ts`
  - checks campaign send limits before broadcast send
- `app/admin/tenants/page.tsx`
  - shows plan label + monthly price from canonical entitlement config
- `app/admin/tenants/[slug]/page.tsx`
  - shows per-tenant hard-gated feature list and soft-limit values
- `lib/billing/teamSeats.ts` + employee invite/member actions
  - enforces office/field seat caps before invites, accept, role change, reactivation
- `lib/billing/tenantFeatureGate.ts` + gated routes/actions:
  - `customerPortal` — portal invites (`inviteActions.ts`)
  - `plaidReconciliation` — bank connection UI + Plaid link token
  - `jobCosting` — compensation settings mutations
  - `rolePermissions` — admin/viewer team invites and role changes
- `lib/billing/automationWorkflows.ts`
  - enforces `maxAutomationWorkflows` when creating recurring visit rules

Next checks to add:
- integration connection actions -> `includedIntegrations`
- SMS review-request campaigns (email `review_ask` template parity)

## Stripe mapping and fulfillment

- Keep using tier-specific env variables:
  - `STRIPE_PLATFORM_PRICE_STARTER`
  - `STRIPE_PLATFORM_PRICE_BUSINESS`
  - `STRIPE_PLATFORM_PRICE_PRO`
- At checkout + webhook sync, map Stripe subscription metadata to
  `tenant_billing_accounts.platform_plan`.
- Entitlement resolution reads `tenant_billing_accounts.platform_plan`; fallback
  defaults to `starter` if missing.

### Platform Stripe webhook idempotency

- Migration `0008_stripe_webhook_idempotency.sql` adds `public.stripe_webhook_events` (`stripe_event_id` unique).
- `app/api/webhooks/stripe/route.ts` records each event before handling; duplicates return `200` without re-running side effects.
- On handler failure after insert, the row is deleted so Stripe retries can succeed.

### Trial end without a card (no-card checkout)

Checkout uses `payment_method_collection: 'if_required'` and Stripe can end the
subscription when the trial ends without a payment method. Webhook handler
`app/api/webhooks/stripe/route.ts` then:

- sets `tenant_billing_accounts.status` to `canceled`, sets `canceled_at`, clears
  `stripe_subscription_id` (so a later Checkout can attach a new subscription)
- sets `tenants.is_active` to `false`

**Triggers (use all three layers):**

| Layer | When it runs | What it does |
| ----- | ------------- | ------------- |
| Stripe webhooks | Trial ends on a platform subscription; ~3 days before end | `customer.subscription.updated/deleted` syncs status; `customer.subscription.trial_will_end` emails the owner (Resend) |
| In-app | Every tenant portal request | `TrialSubscriptionBanner` + `lib/billing/tenantSubscriptionAccess.ts` countdown / “subscribe” CTA |
| Cron safety net | Daily (`/api/cron/expire-stale-trials`) | Expires DB-only trials (`status=trialing`, `trial_ends_at` past, no `stripe_subscription_id`) |
| Auto-purge | Daily (`/api/cron/purge-unconverted-trials`) | Hard-deletes never-activated workspaces 30 days after trial end |

Tenant portal access (`lib/auth/tenantAccess.ts`) blocks normal members when the
workspace is inactive, billing is `canceled`, or the trial end date has passed without
an active subscription (`trial_expired`). Users are redirected to `/billing?subscribe=required`.
Only the **workspace billing hub** (`/billing`) and **owner account settings**
(`/settings/account`, for self-service workspace deletion) stay reachable while suspended.
Customer invoice sub-routes (`/billing/invoices`, etc.) stay locked until subscribed.
Platform admins can still open the tenant for support.

### Unconverted trial auto-purge (30-day grace)

Workspaces that **never activated** a paid subscription (`tenant_billing_accounts.activated_at`
is null) are hard-deleted **30 days after `trial_ends_at`**. This applies to trial-only
workspaces that never completed Checkout or whose Stripe subscription was canceled at trial end.

| Layer | When it runs | What it does |
| ----- | ------------- | ------------- |
| Daily cron | `/api/cron/purge-unconverted-trials` (07:30 UTC, after `expire-stale-trials`) | Finds `activated_at IS NULL` rows with `trial_ends_at` at least 30 days ago; hard-deletes tenant (DB cascade); best-effort Stripe subscription cancel |
| In-app UX | Billing page + paused banner + Account settings | Countdown to auto-purge date; owner can delete immediately via slug confirmation |
| Audit | Before delete | `audit_log_entries` row `tenant.workspace_purged` with reason (`auto_unconverted_trial` or `owner_requested`) |

Owner self-delete: **Account → Delete workspace** (`app/tenant/settings/deleteWorkspaceActions.ts`).
Only the workspace **owner** may delete; slug must be typed to confirm. Auth users are not
deleted (they may belong to other workspaces). Voluntary closure by an owner on an activated
workspace follows the general retention schedule (export window), not the 30-day auto-purge rule.

Configure two Stripe event destinations (see Connect section below): platform includes `customer.subscription.trial_will_end`.

## Ticket template (implementation-ready)

- Add gate check in `<route-or-action>`
- Resolve plan with `resolveTenantPlanTier(admin, tenantId)`
- Add `assertFeatureEnabled(...)` or `assertLimitNotExceeded(...)`
- Return upgrade-oriented error message on block
- Add tests:
  - Starter blocked where expected
  - Business allowed for mid-tier features
  - Pro allowed for all gates
  - limit reached path returns deterministic error

## Stripe Connect (tenant → customer payments)

**Status (2026-05-12):** MVP shipped. Tenants onboard **Stripe Connect Express** from **`/billing/payment-setup`**. Open invoices (`tenant_invoices`) can launch **Checkout** on the connected account when `tenants.stripe_connect_status = complete`. Webhook handler: `checkout.session.completed` (payment mode, `metadata.kind=tenant_invoice_pay`) and `account.updated` — see `app/api/webhooks/stripe/route.ts` and `lib/stripe/connectWebhookHandlers.ts`.

**Environment**

- `STRIPE_SECRET_KEY` — platform secret (also used to create Express accounts and Checkout on behalf of connected accounts).
- `STRIPE_WEBHOOK_SECRET` — signing secret for destination scoped to **Your account** → `POST /api/webhooks/stripe` (tenant platform subscriptions).
- `STRIPE_CONNECT_WEBHOOK_SECRET` — signing secret for destination scoped to **Connected accounts** → `POST /api/webhooks/stripe/connect` (invoice pay, customer subs, disputes, payouts). Stripe does not allow both scopes on one destination; register two destinations in the Dashboard.
- Optional `STRIPE_CONNECT_APPLICATION_FEE_BPS` — platform application fee on invoice Checkout (basis points).

**Schema** — migration `0023_tenant_billing_stripe_connect.sql`: `tenant_stripe_connect_accounts`, `tenants.stripe_connect_status`, extended `tenant_invoice_payments`, `tenant_usage_snapshots` (rollup TBD), mirror tables for refunds/disputes/payouts (webhook writers TBD).

**Gates** — `lib/billing/requireConnect.ts`; manual **card** entry on invoices is blocked (`recordInvoicePaymentAction`); use **Pay online** only after Connect completes. The same gate applies to **subscription Checkout** (tenant customer detail) and **customer portal invoice pay** (`createCustomerInvoicePayCheckoutSessionAction`).
