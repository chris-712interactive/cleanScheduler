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
  | 'forecasting'
  | 'fullApiWebhooks'
  | 'multiLocationControls'
  | 'dedicatedOnboarding';

type EntitlementLimitKey =
  | 'includedSeats'
  | 'maxActiveCustomers'
  | 'maxAutomationWorkflows'
  | 'includedSmsCreditsMonthly'
  | 'includedEmailCreditsMonthly'
  | 'includedIntegrations';

interface PlanEntitlements {
  plan: 'starter' | 'business' | 'pro';
  displayName: string;
  monthlyPriceUsd: number; // 39, 129, 299
  annualEffectiveMonthlyUsd: number; // 31, 103, 239
  features: Record<EntitlementFeature, boolean>;
  limits: Record<EntitlementLimitKey, number>;
}
```

## Price points

- Starter: `$39/mo` (`$31` annual-effective)
- Business: `$129/mo` (`$103` annual-effective)
- Pro: `$299/mo` (`$239` annual-effective)

## Required API/server-action checks

### 1) Hard gates (feature flags)

Before premium operations run, call `assertFeatureEnabled(planTier, feature)`.

Recommended first checks to implement:

- API integrations / webhooks endpoints -> `fullApiWebhooks`
- analytics/reporting endpoints -> `advancedAnalytics`
- forecast endpoints -> `forecasting`
- onboarding concierge flows -> `dedicatedOnboarding`
- multi-location management routes -> `multiLocationControls`

### 2) Soft limits (metered caps)

Before creating or triggering resource-heavy actions, call:

`assertLimitNotExceeded(planTier, limitKey, currentValue)`

Current implementation:

- `app/tenant/customers/actions.ts`
  - checks `maxActiveCustomers` before creating a customer
- `app/admin/tenants/page.tsx`
  - shows plan label + monthly price from canonical entitlement config
- `app/admin/tenants/[slug]/page.tsx`
  - shows per-tenant hard-gated feature list and soft-limit values

Next checks to add:

- seat invites / membership creation -> `includedSeats`
- workflow creation actions -> `maxAutomationWorkflows`
- SMS send pipeline -> `includedSmsCreditsMonthly`
- campaign email sends -> `includedEmailCreditsMonthly`
- integration connection actions -> `includedIntegrations`

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

Tenant portal access (`lib/auth/tenantAccess.ts`) blocks normal members when the
workspace is inactive or billing status is `canceled`, with copy at
`/access-denied?reason=billing_suspended`. Platform admins can still open the
tenant for support.

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
