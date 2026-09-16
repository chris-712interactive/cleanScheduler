# Admin fraud controls (Phase 1)

**Status:** Implemented 2026-09-16

Platform admins can respond to Connect fraud without waiting for Stripe Dashboard alone.

## Capabilities

| Control                    | Where                           | Effect                                                                                                                                   |
| -------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Suspend portal access**  | Admin → Tenants → tenant detail | Sets `tenants.admin_access_suspended_at`; members hit `/access-denied?reason=workspace_suspended`. Platform admins can still masquerade. |
| **Freeze Connect charges** | Same                            | Sets `tenants.connect_charges_frozen_at`; `requireConnectForOnlinePayments` blocks all Connect Checkout even if Connect is `complete`.   |
| **Fraud alerts inbox**     | Admin → Fraud alerts (`/fraud`) | Velocity blocks, disputes (30d), and recent suspend/freeze audit events.                                                                 |
| **Connect strip**          | Tenant detail risk card         | Connect `acct_…`, status, charges/payouts, dispute + velocity counts.                                                                    |
| **Tenant search**          | Admin → Tenants                 | Search by Connect `acct_…`, platform `cus_`/`sub_`, tenant UUID, slug, or name.                                                          |

## Schema

Migration `0089_admin_tenant_fraud_controls.sql`:

- `tenants.admin_access_suspended_at` / `admin_access_suspended_reason`
- `tenants.connect_charges_frozen_at` / `connect_charges_frozen_reason`

Billing webhooks (`syncTenantPlatformSubscription`) will not clear admin suspension or re-activate `is_active` while suspended.

## Audit actions

- `tenant.admin_access_suspended` / `tenant.admin_access_unsuspended`
- `connect.charges_frozen` / `connect.charges_unfrozen`
- (existing) `connect.velocity_blocked`

## Stripe identifiers

| Stripe value                                | Table / column                                     |
| ------------------------------------------- | -------------------------------------------------- |
| Connect Express `acct_…`                    | `tenant_stripe_connect_accounts.stripe_account_id` |
| Platform customer `cus_…`                   | `tenant_billing_accounts.stripe_customer_id`       |
| Platform subscription `sub_…`               | `tenant_billing_accounts.stripe_subscription_id`   |
| Account / subscription `metadata.tenant_id` | Our `tenants.id` UUID                              |

Search helper: `lib/admin/searchAdminTenants.ts`.

## Key files

- `lib/admin/tenantRiskControls.ts`, `lib/admin/tenantRiskActions.ts`
- `lib/admin/loadAdminFraudAlerts.ts`, `lib/admin/searchAdminTenants.ts`
- `app/admin/tenants/AdminTenantRiskPanel.tsx`
- `app/admin/fraud/page.tsx`
- Enforcement: `lib/auth/tenantAccess.ts`, `lib/billing/requireConnect.ts`

## Phase 2 (not yet)

- Force-restrict / reject Express accounts via Stripe API
- High-risk tenant flag with tighter velocity
- One-click incident playbook
