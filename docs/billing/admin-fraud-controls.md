# Admin fraud controls (Phase 1)

**Status:** Implemented 2026-09-16

Platform admins can respond to Connect fraud without waiting for Stripe Dashboard alone.

## Capabilities

| Control                    | Where                           | Effect                                                                                                                                   |
| -------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Suspend portal access**  | Admin → Tenants → tenant detail | Sets `tenants.admin_access_suspended_at`; members hit `/access-denied?reason=workspace_suspended`. Platform admins can still masquerade. |
| **Freeze Connect charges** | Same                            | Sets `tenants.connect_charges_frozen_at`; `requireConnectForOnlinePayments` blocks all Connect Checkout even if Connect is `complete`.   |
| **Fraud alerts inbox**     | Admin → Fraud alerts (`/fraud`) | Velocity blocks, disputes (30d), and recent suspend/freeze audit events.                                                                 |
| **Connect strip**          | Tenant detail risk card         | Connect status, charges/payouts flags, dispute + velocity counts.                                                                        |

## Schema

Migration `0089_admin_tenant_fraud_controls.sql`:

- `tenants.admin_access_suspended_at` / `admin_access_suspended_reason`
- `tenants.connect_charges_frozen_at` / `connect_charges_frozen_reason`

Billing webhooks (`syncTenantPlatformSubscription`) will not clear admin suspension or re-activate `is_active` while suspended.

## Audit actions

- `tenant.admin_access_suspended` / `tenant.admin_access_unsuspended`
- `connect.charges_frozen` / `connect.charges_unfrozen`
- (existing) `connect.velocity_blocked`

## Key files

- `lib/admin/tenantRiskControls.ts`, `lib/admin/tenantRiskActions.ts`
- `lib/admin/loadAdminFraudAlerts.ts`
- `app/admin/tenants/AdminTenantRiskPanel.tsx`
- `app/admin/fraud/page.tsx`
- Enforcement: `lib/auth/tenantAccess.ts`, `lib/billing/requireConnect.ts`

## Phase 2 (not yet)

- Force-restrict / reject Express accounts via Stripe API
- High-risk tenant flag with tighter velocity
- One-click incident playbook
