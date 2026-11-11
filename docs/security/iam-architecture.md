# IAM Architecture

**Last updated:** November 11, 2026

## Identity types

| Type           | Store                                    | Used for                                         |
| -------------- | ---------------------------------------- | ------------------------------------------------ |
| Platform user  | Supabase Auth `app_metadata.app_role`    | Founder admin, sales closer, cross-portal access |
| Tenant member  | `tenant_memberships` + JWT `tenant_role` | Workspace operations portal                      |
| Customer user  | Supabase Auth + `customer_identities`    | Branded customer portal                          |
| Machine (API)  | `tenant_api_keys` (hashed)               | Tenant REST API (Pro plan)                       |
| Machine (cron) | `CRON_SECRET` env                        | Scheduled maintenance routes                     |

## Authentication flow

1. User signs in via Supabase Auth (password, passkey, or Google OAuth). A passkey is checked by Clean Scheduler, then a Supabase session is issued.
2. Middleware refreshes session cookies on each request.
3. Portal layout calls `requirePortalAccess` and `requireTenantPortalAccess`.
4. Tenant workspaces enforce `tenant_operational_settings` passkey and 2FA policy (`lib/auth/enforceTenantAuthPolicy.ts`).
5. Server actions enforce role and feature gates before mutations.

## Authorization layers

1. **Middleware** — session presence for protected portals.
2. **Portal guards** — `lib/auth/portalAccess.ts`, `lib/auth/tenantAccess.ts`.
3. **Role helpers** — `lib/auth/tenantRoleAccess.ts`, `lib/tenant/employeePermissions.ts`.
4. **Postgres RLS** — `has_tenant_membership()`, `is_platform_admin()` in migrations.
5. **Feature entitlements** — plan tier gates in `lib/billing/tenantFeatureGate.ts`.

## JWT claims (app_metadata)

- `app_role` — platform role (`super_admin`, `admin`, `sales`, `employee`, `customer`)
- `tenant_role` — workspace role hint (`owner`, `admin`, `employee`, `viewer`)
- `current_tenant_id` — active workspace context
- `masquerade_target_tenant_id` — support masquerade target

`admin` and `super_admin` are platform staff only. Trial owners, invited tenant admins, and other workspace members are stored as `employee`. Their authority is `tenant_memberships.role`. A platform admin does not open a workspace they are not a member of unless `app_metadata.masquerade_target_tenant_id` is that tenant. `user_metadata` is not a source for `app_role` or the masquerade target. `user_profiles.app_role` is a server-written copy of the Auth claim. It is not a source for platform identity. A signed-in user may update display name and photo columns on their own profile. They cannot update `app_role`, `user_id`, or `created_at` (`0124_user_profiles_privileged_columns.sql`).

Claims are synchronized via `lib/auth/syncUserAuthClaims.ts` on role changes. A workspace role edit keeps an existing platform role only when that role is already in Auth `app_metadata`.

## Service role usage

`createAdminClient()` bypasses RLS. Used only in trusted server paths after application authorization. Tenant portal pages scope queries by `membership.tenantId`.

## Privileged access

- Platform admin: `admin.<domain>` portal, masquerade into one targeted workspace, audit log. Platform admin alone does not open every workspace.
- Platform sales: `admin.<domain>` portal limited to Outreach, Pipeline, and Settings. MFA required. No masquerade, tenant purge, fraud, or accounting.
- Plaid/bank: owner/admin only, MFA required, Business+ plan.
- Integrations: owner/admin for API key create/revoke (audited).

## Workforce IAM

Company personnel access to GitHub, Vercel, Supabase, Stripe, and Plaid is documented in [workforce-access-runbook.md](./workforce-access-runbook.md).
