# Free trial & subscription conversion — product spec

**Status:** Implemented (2026-05-21)

This document defines the target free-trial flow: **DB-only trial at signup**, a fixed **trial entitlement profile**, and **tier + billing interval selection at conversion** when Stripe Checkout runs for the first time.

---

## Goals

1. Let new workspaces evaluate cleanScheduler **without choosing Starter/Business/Pro upfront**.
2. **No Stripe subscription at signup** — trial clock lives in Postgres only.
3. Trial includes **core operational workflows** (scheduling, quotes, customers, invoicing) but **excludes paid integrations** (Plaid, SMS, API) and **limits marketing email**.
4. At trial end (or early subscribe), owner picks **tier + monthly/yearly** → Stripe Checkout → webhook sets `platform_plan`, `billing_interval`, `status=active`.
5. Keep existing safety nets: trial expiry cron, 30-day auto-purge for never-activated workspaces, owner self-delete.

---

## Current vs target

| Step                                    | Today                                                                   | Target                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Signup form                             | Step 3: pick Starter/Business/Pro                                       | No tier picker (optional “compare plans” link to marketing `/pricing`) |
| `tenant_billing_accounts.platform_plan` | Set at signup                                                           | **`NULL` while `status=trialing`**                                     |
| Stripe at signup                        | Redirect to Checkout (`trial_signup`, 7-day Stripe trial on tier price) | **None** — land in tenant portal immediately                           |
| Trial entitlements                      | From chosen tier (`resolveTenantPlanTier`)                              | From **`TRIAL_ENTITLEMENTS`** when trialing + no plan                  |
| Subscribe CTA                           | Uses stored `platform_plan`                                             | **Tier + interval picker** on `/billing` → Checkout `kind=subscribe`   |
| Billing cycle                           | Hardcoded “Monthly” on billing page                                     | Monthly or yearly from picker + Stripe sync                            |
| Trial reminder email                    | Stripe `customer.subscription.trial_will_end`                           | **App cron** for DB-only trials (3 days before end)                    |

---

## End-to-end flows

### A. Signup (new workspace)

```
Marketing onboarding form
  → create auth user + tenant + membership
  → insert tenant_billing_accounts:
       status = 'trialing'
       trial_started_at = now
       trial_ends_at = now + TRIAL_DAYS
       platform_plan = NULL
       stripe_* = NULL
  → sign in → redirect to tenant home (no Stripe)
```

### B. During trial

```
resolveTenantEntitlements(tenantId):
  if billing.status === 'trialing' && platform_plan IS NULL:
    return TRIAL_ENTITLEMENTS
  else:
    return PLATFORM_TIER_ENTITLEMENTS[platform_plan]

Paid-integration gate (unchanged):
  canUsePaidSubscriptionFeatures(status) → active | past_due only
  (blocks SMS, API/webhooks, white-label portal regardless of tier flags)
```

### C. Conversion (trial end or subscribe early)

```
Owner on /billing
  → choose tier (Starter | Business | Pro)
  → choose interval (monthly | yearly)
  → Stripe Checkout (mode=subscription, kind=subscribe, card required, NO trial_period_days)
  → webhook checkout.session.completed / customer.subscription.created
       platform_plan = chosen tier
       billing_interval = month | year
       status = active
       activated_at = now
       stripe_customer_id, stripe_subscription_id set
```

### D. Trial expired (no conversion)

```
resolveTenantSubscriptionAccess → trial_expired
  → middleware redirects to /billing?subscribe=required
  → expire-stale-trials cron (DB-only): status=canceled, tenants.is_active=false
  → purge-unconverted-trials cron: hard-delete 30 days after trial_ends_at if activated_at IS NULL
```

---

## Trial entitlement profile

Add `TRIAL_ENTITLEMENTS` in `lib/billing/entitlements.ts` (parallel to tier map).  
Resolution: **`resolveTenantEntitlements`** branches on trialing + null plan; do **not** default null plan to Starter.

### Recommended defaults (proposal)

These mirror “evaluate the business” without paid integrations or Pro-only scale.

#### Feature flags

| Feature                     | Trial   | Rationale                                                         |
| --------------------------- | ------- | ----------------------------------------------------------------- |
| `rolePermissions`           | **Yes** | Invite admin/viewer; test team workflows                          |
| `jobCosting`                | **Yes** | Tips/commissions are core ops                                     |
| `customerPortal`            | **Yes** | Strong eval hook — customers accept quotes, pay invoices          |
| `proofOfServicePhotos`      | **Yes** | Field crew workflow                                               |
| `gpsVerifiedCheckIn`        | **Yes** | Arrival location proof on check-in                                |
| `proofOfServicePortalShare` | **No**  | Pro-only customer portal share                                    |
| `campaigns`                 | **No**  | Marketing email excluded (see limits)                             |
| `salesTaxSummary`           | **Yes** | Basic financial close                                             |
| `payrollExports`            | **Yes** | Payroll CSV is operational                                        |
| `advancedAnalytics`         | **No**  | Pro reports tier                                                  |
| `forecasting`               | **No**  | Pro reports tier                                                  |
| `fullApiWebhooks`           | **No**  | Paid + integration cost                                           |
| `multiLocationControls`     | **No**  | Pro feature                                                       |
| `dedicatedOnboarding`       | **No**  | Sales/concierge                                                   |
| `plaidReconciliation`       | **No**  | Paid integration (explicit exclusion)                             |
| `smsCommunication`          | **No**  | Paid + sent.dm (also blocked by `canUsePaidSubscriptionFeatures`) |
| `whiteLabelCustomerPortal`  | **No**  | Paid Pro feature                                                  |

#### Soft limits

| Limit                          | Trial (proposed) | Compare                                                         |
| ------------------------------ | ---------------- | --------------------------------------------------------------- |
| `includedOfficeSeats`          | **2**            | Starter 1, Business 2                                           |
| `includedFieldSeats`           | **8**            | Starter 3, Business 10                                          |
| `maxActiveCustomers`           | **2,000**        | Starter 500, Business 5,000                                     |
| `maxAutomationWorkflows`       | **10**           | Starter 3, Business 20                                          |
| `includedIntegrations`         | **2**            | Starter 1, Business 5 (API keys count; API calls still blocked) |
| `includedSmsCreditsMonthly`    | **0**            | —                                                               |
| `includedEmailCreditsMonthly`  | **0**            | Campaign metering only; transactional un metered                |
| `maxCampaignSendsMonthly`      | **0**            | Campaigns off                                                   |
| `maxConcurrentActiveCampaigns` | **0**            | —                                                               |
| `maxCampaignAudienceSize`      | **0**            | —                                                               |
| `maxCampaignDrafts`            | **0**            | —                                                               |

#### Reports during trial

Follow **Phase 1 hub** (`gate: { kind: 'none' }`) + Business mid-tier reports that trial flags allow:

- **Allowed:** AR aging, invoice audit, collections, field checks, quote pipeline, sales tax, payroll export, tips/commissions (via `jobCosting`).
- **Blocked:** Phase 1.5 analytics (`advancedAnalytics`), crew utilization, cohort/LTV (`forecasting`), payment reconciliation (analytics gate).

Implementation: reports already use `isFeatureEnabled(tier, feature)` — trial tier must be a first-class input to report gating (same branch as entitlements).

#### Customer AR / Stripe Connect during trial

**Recommendation: keep unlocked** while `subscriptionAccess` is `trialing` (existing `canAccessCustomerBillingTools`).

Rationale: invoicing and “Pay online” via Connect are core to evaluating the product. Plaid bank reconciliation stays off via `plaidReconciliation: false`.

---

## Email policy during trial

| Channel                                                                  | Trial behavior                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| **Transactional** (quotes, invites, invoice reminders, employee invites) | **Unlimited** — not metered today; keep as-is       |
| **Marketing campaigns** (`/campaigns`)                                   | **Off** — `campaigns: false` + zero campaign limits |
| **Invoice reminder SMS**                                                 | **Off** — requires paid subscription + Pro for SMS  |

Optional future: soft cap on transactional sends for abuse prevention (out of scope unless requested).

---

## Schema changes

### 1. Nullable `platform_plan` during trial

Migration:

```sql
-- platform_plan already nullable; document semantics:
-- NULL = trialing, tier not chosen yet
-- non-NULL = chosen tier (set at conversion or legacy signup)
comment on column public.tenant_billing_accounts.platform_plan is
  'Platform tier (Starter/Business/Pro). NULL while on DB-only free trial before first subscription.';
```

No enum change required.

### 2. Billing interval (new column)

```sql
create type public.platform_billing_interval as enum ('month', 'year');

alter table public.tenant_billing_accounts
  add column billing_interval public.platform_billing_interval;

comment on column public.tenant_billing_accounts.billing_interval is
  'Recurring interval for the active Stripe platform subscription. NULL until first paid subscription.';
```

Set from Checkout metadata and/or Stripe subscription item `price.recurring.interval` in webhook sync.

---

## Stripe & environment

### Checkout kinds

| Kind           | Signup                                 | Conversion                      |
| -------------- | -------------------------------------- | ------------------------------- |
| `trial_signup` | **Remove** (or keep unused for legacy) | —                               |
| `subscribe`    | —                                      | **Only** path for first payment |

### Price IDs (6 required for full monthly/yearly)

Naming proposal (update `.env.example`):

```
STRIPE_PLATFORM_PRICE_STARTER_MONTHLY=
STRIPE_PLATFORM_PRICE_STARTER_YEARLY=
STRIPE_PLATFORM_PRICE_BUSINESS_MONTHLY=
STRIPE_PLATFORM_PRICE_BUSINESS_YEARLY=
STRIPE_PLATFORM_PRICE_PRO_MONTHLY=
STRIPE_PLATFORM_PRICE_PRO_YEARLY=
```

Migrate from current `STRIPE_PLATFORM_PRICE_*` / `*_SUBSCRIBE` vars with a deprecation shim in `resolvePlatformPriceId(tier, interval)`.

**Stripe Dashboard:** create 6 recurring Prices (no default trial on any price). Yearly prices at annual-effective rates from entitlements doc ($372/yr Starter, etc.).

### Webhook sync updates

`lib/billing/syncTenantPlatformSubscription.ts`:

- On active subscription: set `platform_plan` from metadata or price-id map.
- Set `billing_interval` from price recurring interval.
- Set `activated_at` on first transition to `active` (existing behavior).

### Customer Portal

After first subscription, **Manage plan** via Stripe Billing Portal remains valid for upgrades/downgrades. Portal product catalog should list all 6 prices or 3 products × 2 intervals.

---

## UI changes

### Onboarding (`TenantOnboardingForm`)

- **Remove** step 3 tier picker (or replace with static “All plans include a 7-day free trial” + link to `/pricing`).
- Copy: “No credit card required. Choose your plan when you're ready to subscribe.”
- Server action: stop requiring `platform_plan`; insert `platform_plan: null`; **remove** Checkout redirect.

### Billing (`/tenant/billing`)

Replace single “Subscribe with Stripe” button with:

1. **Plan comparison** — 3 tier cards (reuse marketing bullets from `getPlatformPricingDisplay`).
2. **Interval toggle** — Monthly / Yearly (show annual savings vs 12× monthly).
3. **Subscribe** — passes `platform_plan` + `billing_interval` to server action → Checkout.

States:

| Access          | UI                                                                       |
| --------------- | ------------------------------------------------------------------------ |
| `trialing`      | “Free trial · X days left” + early subscribe picker                      |
| `trial_expired` | Block portal except `/billing`; prominent subscribe picker               |
| `active`        | Show current tier, interval, next payment; “Manage plan” → Stripe Portal |

Display when `platform_plan` is null: **“Free trial — choose a plan to subscribe”** (not “No plan selected” as error).

### Banners

`TrialSubscriptionBanner`: unchanged logic; link to `/billing` subscribe section.

---

## Notifications

### DB-only trial ending soon

New cron (e.g. daily with `expire-stale-trials`):

- Find `status=trialing`, `stripe_subscription_id IS NULL`, `trial_ends_at` in 3 days.
- Email owner (reuse copy from `trialEndingNotifications.ts`, minus Stripe payment-method line).
- Idempotency: `tenant_billing_accounts.trial_ending_email_sent_at` or audit log flag.

### Trial ended

Optional: email on `trial_expired` when cron sets `canceled` (nice-to-have).

---

## Access control summary

| Capability                      | Trial                 | After subscribe |
| ------------------------------- | --------------------- | --------------- |
| Scheduling, quotes, customers   | Yes (trial limits)    | Tier limits     |
| Customer portal (shared `my.*`) | Yes                   | Tier            |
| Customer invoicing + Connect    | Yes                   | Yes             |
| Plaid reconciliation            | **No**                | Business+       |
| SMS                             | **No**                | Pro + paid      |
| API / webhooks                  | **No**                | Pro + paid      |
| Email campaigns                 | **No**                | Business+       |
| White-label portal domain       | **No**                | Pro + paid      |
| Portal suspended at trial end   | Yes → `/billing` only | —               |

---

## Legacy & migration

### Existing workspaces

| State                                         | Handling                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `trialing` + `platform_plan` set + Stripe sub | Leave as-is until sub ends; webhook-driven                                                               |
| `trialing` + `platform_plan` set + no Stripe  | Treat as **legacy intent**; at subscribe use picker (ignore stored plan) OR pre-select stored plan in UI |
| `trialing` + null plan                        | Target state                                                                                             |
| `active`                                      | No change                                                                                                |

**Recommendation:** During implementation, **`resolveTenantEntitlements` uses `TRIAL_ENTITLEMENTS` for all `status=trialing` workspaces**, regardless of legacy `platform_plan`, so behavior is consistent. Clear `platform_plan` on new signups only; optionally backfill null for trialing rows in a one-time migration.

### Deprecate `trial_signup`

- Remove Checkout redirect from onboarding.
- Keep code path behind flag for one release if needed, then delete.
- Update `docs/billing/tier-entitlements.md` trial section.

---

## Implementation phases

| Phase | Scope                                                            | Files (indicative)                                                                  |
| ----- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **1** | `TRIAL_ENTITLEMENTS`, `resolveTenantEntitlements`, report gating | `lib/billing/entitlements.ts`, `tenantFeatureGate.ts`, `reportCatalog.ts` consumers |
| **2** | Onboarding: null plan, no Stripe                                 | `onboarding/actions.ts`, `TenantOnboardingForm.tsx`                                 |
| **3** | Billing subscribe UI + action params                             | `billing/page.tsx`, `billing/actions.ts`, new client picker component               |
| **4** | Stripe 6-price resolver + interval column + webhook              | `platformPlans.ts`, migration, `syncTenantPlatformSubscription.ts`, `.env.example`  |
| **5** | DB trial reminder cron + docs                                    | new cron route, `trialEndingNotifications.ts` refactor                              |
| **6** | Tests + tier-entitlements doc update                             | entitlement tests, onboarding test                                                  |

---

## Open decisions (please confirm)

Reply with choices (or edits) before implementation.

### Trial duration

- **A.** 7 days (current default) — **recommended**
- **B.** 14 days
- **C.** Other: \_\_\_

### Trial limits — seats & customers

- **A.** Proposed table above (2 office / 8 field / 2,000 customers) — **recommended**
- **B.** More generous (match Business limits)
- **C.** More restrictive (match Starter limits)

### Customer portal during trial

- **A.** Yes (`customerPortal: true`) — **recommended**
- **B.** No (Starter-like)

### Stripe Connect + tenant invoicing during trial

- **A.** Yes — **recommended**
- **B.** No (unlock only after subscribe)

### Proof-of-service photos during trial

- **A.** Crew upload yes, portal share no (proposed) — **recommended**
- **B.** Both off
- **C.** Both on

### Payroll / sales tax reports during trial

- **A.** Yes (proposed) — **recommended**
- **B.** No (Starter-like report set only)

### Campaigns during trial

- **A.** Fully off (proposed) — **recommended**
- **B.** Limited (e.g. 1 campaign, 500 sends/month)

### Early subscribe during trial

- **A.** Yes — same tier + interval picker — **recommended**
- **B.** Only at trial end

### Annual pricing UX

- **A.** Toggle on billing page; show “Save X%” vs monthly — **recommended**
- **B.** Monthly only at launch; add yearly later

### Legacy trialing tenants with `platform_plan` already set

- **A.** Use trial entitlements until convert; picker at subscribe — **recommended**
- **B.** Keep tier entitlements during trial for legacy rows only

### Trial reminder email timing

- **A.** 3 days before `trial_ends_at` (match Stripe behavior) — **recommended**
- **B.** 1 day before
- **C.** Both 3-day and 1-day

---

## References

- Entitlements source: `lib/billing/entitlements.ts`
- Trial access: `lib/billing/tenantSubscriptionAccess.ts`
- Tier entitlements doc: `docs/billing/tier-entitlements.md`
- Expire cron: `lib/billing/expireStaleTrials.ts`
- Auto-purge: `lib/billing/tenantPurge.ts`
