# Tenant claim sync under concurrency

## What was wrong

`syncUserAuthClaims` loaded Auth `app_metadata`, copied the object, and sent that copy to `updateUserById`. GoTrue merges `app_metadata` (`clearedMasqueradeAppMetadata` in `lib/auth/masqueradeSession.ts`). A key in the stale copy overwrites a newer value. Two operations on one user — deactivating tenant A while another tenant adds a membership, changes the role, or reactivates — could finish with `current_tenant_id` on an inactive membership or with `tenant_role` from the older row.

Deleting a key on the copied object omitted it from the JSON body. A merge keeps omitted keys, so that clear left `current_tenant_id` and `tenant_role` in place.

## What we do now

`syncTenantClaimsFromMemberships` loads active `tenant_memberships` and the Auth user, then patches only `current_tenant_id` and `tenant_role`. JSON null removes a claim. `app_role`, masquerade keys, and `user_metadata` are not written. After the write it reads again. If the stored claims disagree with a fresh membership read, it recomputes, up to five times.

Rules once the membership rows are visible:

- Role edit: that tenant becomes current when the row is still active, and the role is the row's role.
- Reactivation: that tenant is used only when the current claim is missing or not an active membership.
- Deactivation: keep the current tenant when it is still active. Otherwise use the oldest active membership (`created_at`, then `tenant_id`), or clear both claims when none remain.

Platform role still comes from Auth `app_metadata` only. `preservePlatformRoleFromAuth` on the role-edit call site means the returned `app_role` is that Auth value, and this sync does not write `app_role`.

`syncUserAuthClaims` now sends the same kind of patch for callers that already know the next values. It no longer writes the rest of the snapshot back.

No migration. Nothing to apply by hand.

## How to verify

`lib/auth/syncTenantClaimsFromMemberships.test.ts` holds the first Auth write, lets a second sync commit, then releases the stale patch. The cases are a deactivate racing an add, a deactivate racing a role change, and two deactivations. The assertions are that `current_tenant_id` is an active membership (or both tenant claims are gone), `tenant_role` is that row's role, and `app_role` plus any masquerade key are unchanged. `user_metadata` is not written.
