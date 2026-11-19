# Tenant claims do not trust user_metadata

`extractClaims` (`lib/auth/types.ts`) reads `app_role`, `tenant_role`, `current_tenant_id`, and `masquerade_target_tenant_id` from Auth `app_metadata` only. `user_metadata` is writable with `supabase.auth.updateUser` and must not be copied back into `app_metadata`.

What actually consumed the tenant fields before this change:

- Post-login routing (`resolvePostLoginDestinationForUser`) passed `claims.currentTenantId` into `preferredTenantSlug`. That helper only selects a slug when the id is already in the user's active `tenant_memberships`. A forged id for a workspace the user does not belong to did not open that workspace. A forged id for a second workspace they do belong to could change which of their own hosts they landed on.
- `claims.tenantRole` was not read by portal guards, tenant API checks, or RLS. Those use `tenant_memberships.role` (and `has_tenant_membership()`). Tenant claim sync writes `app_metadata.tenant_role` from the active membership row, not from `extractClaims` and not from `user_metadata`.
- Postgres `current_tenant_id()` and `current_app_role()` already select `auth.jwt() -> 'app_metadata'`. No migration was required.

Routing now calls `trustedPostLoginTenantId`: the membership for the current tenant host wins; otherwise `app_metadata.current_tenant_id` is used only when it matches an active membership. Blank or whitespace-only claim strings are null. When no trusted tenant id matches, the fallback is the oldest active membership (`created_at` ascending, then `tenant_id`).

Deactivating, reactivating, or changing a member's role recomputes those claims in `syncTenantClaimsFromMemberships`. The read is `extractClaims` (`app_metadata` only) plus active `tenant_memberships`. The write is a patch of `current_tenant_id` and `tenant_role` only. GoTrue merges `app_metadata`, and JSON null removes a key, so a clear does not depend on omitting the key. If the stored claims do not match a fresh membership read, the sync retries. That covers a deactivate racing an add, role change, or reactivation for the same user in another tenant. Details: [`tenant-claim-sync-race.md`](tenant-claim-sync-race.md).

Do not widen the auth cookie domain. Do not weaken `platformAdminFixtureBlock`. Do not treat `user_metadata` as a hint for authorization or redirects.
