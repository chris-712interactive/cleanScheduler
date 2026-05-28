# IAM Architecture

**Last updated:** May 24, 2026

## Identity types

| Type           | Store                                    | Used for                           |
| -------------- | ---------------------------------------- | ---------------------------------- |
| Platform user  | Supabase Auth + `user_profiles.app_role` | Founder admin, cross-portal access |
| Tenant member  | `tenant_memberships` + JWT `tenant_role` | Workspace operations portal        |
| Customer user  | Supabase Auth + `customer_identities`    | Branded customer portal            |
| Machine (API)  | `tenant_api_keys` (hashed)               | Tenant REST API (Pro plan)         |
| Machine (cron) | `CRON_SECRET` env                        | Scheduled maintenance routes       |

## Authentication flow

1. User signs in via Supabase Auth (password or Google OAuth).
2. Middleware refreshes session cookies on each request.
3. Portal layout calls `requirePortalAccess` and `requireTenantPortalAccess`.
4. Server actions enforce role and feature gates before mutations.

## Authorization layers

1. **Middleware** — session presence for protected portals.
2. **Portal guards** — `lib/auth/portalAccess.ts`, `lib/auth/tenantAccess.ts`.
3. **Role helpers** — `lib/auth/tenantRoleAccess.ts`, `lib/tenant/employeePermissions.ts`.
4. **Postgres RLS** — `has_tenant_membership()`, `is_platform_admin()` in migrations.
5. **Feature entitlements** — plan tier gates in `lib/billing/tenantFeatureGate.ts`.

## JWT claims (app_metadata)

- `app_role` — platform role (`super_admin`, `admin`, `employee`, `customer`)
- `tenant_role` — workspace role (`owner`, `admin`, `employee`, `viewer`)
- `current_tenant_id` — active workspace context
- `masquerade_target_tenant_id` — support masquerade target

Claims are synchronized via `lib/auth/syncUserAuthClaims.ts` on role changes.

## Service role usage

`createAdminClient()` bypasses RLS. Used only in trusted server paths after application authorization. Tenant portal pages scope queries by `membership.tenantId`.

## Privileged access

- Platform admin: `admin.<domain>` portal, masquerade, audit log.
- Plaid/bank: owner/admin only, MFA required, Business+ plan.
- Integrations: owner/admin for API key create/revoke (audited).

## Workforce IAM

Company personnel access to GitHub, Vercel, Supabase, Stripe, and Plaid is documented in [workforce-access-runbook.md](./workforce-access-runbook.md).
