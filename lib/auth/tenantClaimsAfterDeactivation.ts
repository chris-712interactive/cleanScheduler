import type { SupabaseClient } from '@supabase/supabase-js';
import { comparePostLoginMemberships } from '@/lib/auth/resolvePostLoginDestination';
import { syncUserAuthClaims } from '@/lib/auth/syncUserAuthClaims';
import { extractClaims, type TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

export interface ActiveMembershipClaim {
  tenantId: string;
  role: TenantRole;
  createdAt: string;
}

export type TenantClaimUpdate =
  | { action: 'leave' }
  | { action: 'clear' }
  | { action: 'switch'; tenantId: string; tenantRole: TenantRole };

function isTenantRole(value: string): value is TenantRole {
  return value === 'owner' || value === 'admin' || value === 'employee' || value === 'viewer';
}

/**
 * Claims to write after a membership is deactivated.
 *
 * The fallback is the oldest remaining active membership (`created_at`, then
 * `tenant_id`), the same order as post-login routing. The current tenant is
 * the `app_metadata` claim only.
 */
export function tenantClaimsAfterDeactivation(input: {
  deactivatedTenantId: string;
  currentTenantId: string | null;
  activeMemberships: ActiveMembershipClaim[];
}): TenantClaimUpdate {
  const active = input.activeMemberships
    .filter((membership) => membership.tenantId !== input.deactivatedTenantId)
    .sort(comparePostLoginMemberships);

  if (active.length === 0) return { action: 'clear' };
  if (input.currentTenantId !== input.deactivatedTenantId) return { action: 'leave' };

  const fallback = active[0]!;
  return { action: 'switch', tenantId: fallback.tenantId, tenantRole: fallback.role };
}

/**
 * Point `app_metadata` tenant claims at a remaining membership, or clear them
 * when none remain. Does not read or write `user_metadata`.
 */
export async function syncTenantClaimsAfterDeactivation(
  admin: AdminClient,
  input: { userId: string; deactivatedTenantId: string },
): Promise<void> {
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(input.userId);
  if (userErr || !userRes.user) {
    throw new Error(userErr?.message ?? 'User not found for claim sync.');
  }

  const { data, error } = await admin
    .from('tenant_memberships')
    .select('tenant_id, role, created_at')
    .eq('user_id', input.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .order('tenant_id', { ascending: true });
  if (error) throw new Error(error.message);

  const activeMemberships: ActiveMembershipClaim[] = [];
  for (const row of data ?? []) {
    if (!isTenantRole(row.role)) continue;
    activeMemberships.push({
      tenantId: row.tenant_id,
      role: row.role,
      createdAt: row.created_at ?? '',
    });
  }

  const next = tenantClaimsAfterDeactivation({
    deactivatedTenantId: input.deactivatedTenantId,
    currentTenantId: extractClaims(userRes.user).currentTenantId,
    activeMemberships,
  });
  if (next.action === 'leave') return;

  await syncUserAuthClaims(admin, input.userId, {
    tenantRole: next.action === 'clear' ? null : next.tenantRole,
    currentTenantId: next.action === 'clear' ? null : next.tenantId,
  });
}
