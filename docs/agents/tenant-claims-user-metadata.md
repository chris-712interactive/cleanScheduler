# Tenant claims do not trust user_metadata

`extractClaims` (`lib/auth/types.ts`) reads `app_role`, `tenant_role`, `current_tenant_id`, and `masquerade_target_tenant_id` from Auth `app_metadata` only. `user_metadata` is writable with `supabase.auth.updateUser` and must not be copied back into `app_metadata`.

What actually consumed the tenant fields before this change:

- Post-login routing (`resolvePostLoginDestinationForUser`) passed `claims.currentTenantId` into `preferredTenantSlug`. That helper only selects a slug when the id is already in the user's active `tenant_memberships`. A forged id for a workspace the user does not belong to did not open that workspace. A forged id for a second workspace they do belong to could change which of their own hosts they landed on.
- `claims.tenantRole` was not read by portal guards, tenant API checks, or RLS. Those use `tenant_memberships.role` (and `has_tenant_membership()`). `syncUserAuthClaims` writes `app_metadata.tenant_role` only from the role argument the server passes in, which comes from the membership update, not from `extractClaims`.
- Postgres `current_tenant_id()` and `current_app_role()` already select `auth.jwt() -> 'app_metadata'`. No migration was required.

Routing now calls `trustedPostLoginTenantId`: the membership for the current tenant host wins; otherwise `app_metadata.current_tenant_id` is used only when it matches an active membership.

Do not widen the auth cookie domain. Do not weaken `platformAdminFixtureBlock`. Do not treat `user_metadata` as a hint for authorization or redirects.
