import type { SupabaseClient } from '@supabase/supabase-js';
import { comparePostLoginMemberships } from '@/lib/auth/resolvePostLoginDestination';
import { extractClaims, type AppRole, type TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

export interface ActiveMembershipClaim {
  tenantId: string;
  role: TenantRole;
  createdAt: string;
}

export interface TenantClaimTarget {
  currentTenantId: string | null;
  tenantRole: TenantRole | null;
}

/**
 * How many times to recompute after a write that lost to another update.
 * Each attempt reads memberships and Auth again, then patches only the two
 * tenant claim keys.
 */
const CLAIM_SYNC_ATTEMPTS = 5;

function isTenantRole(value: string): value is TenantRole {
  return value === 'owner' || value === 'admin' || value === 'employee' || value === 'viewer';
}

/**
 * Tenant claims that match the active membership rows.
 *
 * When `preferredTenantId` is active and `preferTenantWhenCurrentInvalid` is
 * not set, that membership becomes the current tenant. Reactivation sets the
 * flag so an already-valid current tenant is left in place. Otherwise the
 * current tenant is kept when it is still active, then the oldest remaining
 * membership (`created_at`, then `tenant_id`). Both claims are null when
 * nothing is active. The role always comes from the membership row.
 */
export function desiredTenantClaims(input: {
  activeMemberships: ActiveMembershipClaim[];
  currentTenantId: string | null;
  preferredTenantId?: string | null;
  preferTenantWhenCurrentInvalid?: boolean;
}): TenantClaimTarget {
  const active = [...input.activeMemberships].sort(comparePostLoginMemberships);
  const byId = new Map(active.map((membership) => [membership.tenantId, membership]));
  const preferred = input.preferredTenantId ? byId.get(input.preferredTenantId) : undefined;
  const current = input.currentTenantId ? byId.get(input.currentTenantId) : undefined;

  if (preferred && !input.preferTenantWhenCurrentInvalid) {
    return { currentTenantId: preferred.tenantId, tenantRole: preferred.role };
  }
  if (current) {
    return { currentTenantId: current.tenantId, tenantRole: current.role };
  }
  if (preferred) {
    return { currentTenantId: preferred.tenantId, tenantRole: preferred.role };
  }
  const fallback = active[0];
  if (!fallback) return { currentTenantId: null, tenantRole: null };
  return { currentTenantId: fallback.tenantId, tenantRole: fallback.role };
}

async function loadActiveMemberships(
  admin: AdminClient,
  userId: string,
): Promise<ActiveMembershipClaim[]> {
  const { data, error } = await admin
    .from('tenant_memberships')
    .select('tenant_id, role, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .order('tenant_id', { ascending: true });
  if (error) throw new Error(error.message);

  const active: ActiveMembershipClaim[] = [];
  for (const row of data ?? []) {
    if (!isTenantRole(row.role)) continue;
    active.push({
      tenantId: row.tenant_id,
      role: row.role,
      createdAt: row.created_at ?? '',
    });
  }
  return active;
}

function claimsMatch(
  claims: { currentTenantId: string | null; tenantRole: TenantRole | null },
  desired: TenantClaimTarget,
): boolean {
  return (
    claims.currentTenantId === desired.currentTenantId && claims.tenantRole === desired.tenantRole
  );
}

/**
 * Point `app_metadata` tenant claims at the active membership rows.
 *
 * GoTrue merges `app_metadata`. This writes only `current_tenant_id` and
 * `tenant_role`, and sends JSON null to remove them. It does not read or
 * write `user_metadata`, and it does not copy `app_role` or masquerade keys
 * from a stale snapshot. After each write it reads again. A concurrent
 * membership change that landed in between is recomputed, up to
 * {@link CLAIM_SYNC_ATTEMPTS} times.
 *
 * `preservePlatformRoleFromAuth` is the call-site contract for workspace role
 * edits: the platform role returned here is Auth `app_metadata.app_role`.
 * This function never writes `app_role`.
 */
export async function syncTenantClaimsFromMemberships(
  admin: AdminClient,
  input: {
    userId: string;
    preferredTenantId?: string | null;
    preferTenantWhenCurrentInvalid?: boolean;
    preservePlatformRoleFromAuth?: boolean;
  },
): Promise<AppRole | null> {
  // The flag is the role-edit contract. Platform role is never taken from the caller.
  void input.preservePlatformRoleFromAuth;

  let appRole: AppRole | null = null;
  for (let attempt = 0; attempt < CLAIM_SYNC_ATTEMPTS; attempt++) {
    const memberships = await loadActiveMemberships(admin, input.userId);
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(input.userId);
    if (userErr || !userRes.user) {
      throw new Error(userErr?.message ?? 'User not found for claim sync.');
    }

    const claims = extractClaims(userRes.user);
    appRole = claims.appRole;
    const desired = desiredTenantClaims({
      activeMemberships: memberships,
      currentTenantId: claims.currentTenantId,
      preferredTenantId: input.preferredTenantId,
      preferTenantWhenCurrentInvalid: input.preferTenantWhenCurrentInvalid,
    });
    if (claimsMatch(claims, desired)) return appRole;

    // Null deletes the key under GoTrue's merge. Omitting it would leave the old value.
    const { error } = await admin.auth.admin.updateUserById(input.userId, {
      app_metadata: {
        current_tenant_id: desired.currentTenantId,
        tenant_role: desired.tenantRole,
      },
    });
    if (error) throw new Error(error.message);
  }

  throw new Error('Could not sync tenant claims after concurrent updates.');
}
