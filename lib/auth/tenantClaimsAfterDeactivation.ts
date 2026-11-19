import type { SupabaseClient } from '@supabase/supabase-js';
import { comparePostLoginMemberships } from '@/lib/auth/resolvePostLoginDestination';
import {
  syncTenantClaimsFromMemberships,
  type ActiveMembershipClaim,
} from '@/lib/auth/syncTenantClaimsFromMemberships';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

export type { ActiveMembershipClaim };

export type TenantClaimUpdate =
  | { action: 'leave' }
  | { action: 'clear' }
  | { action: 'switch'; tenantId: string; tenantRole: TenantRole };

/**
 * Claims to write after a membership is deactivated.
 *
 * The fallback is the oldest remaining active membership (`created_at`, then
 * `tenant_id`), the same order as post-login routing. The current tenant is
 * the `app_metadata` claim only. Callers that sync Auth use
 * `syncTenantClaimsFromMemberships`, which recomputes from the membership
 * rows and retries if another update lands first.
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
 * Recompute tenant claims from active memberships after `deactivatedTenantId`
 * was marked inactive. The id is not a second filter. Active rows win,
 * including a reactivation that committed before this read.
 *
 * Does not read or write `user_metadata`.
 */
export async function syncTenantClaimsAfterDeactivation(
  admin: AdminClient,
  input: { userId: string; deactivatedTenantId: string },
): Promise<void> {
  void input.deactivatedTenantId;
  await syncTenantClaimsFromMemberships(admin, {
    userId: input.userId,
    preservePlatformRoleFromAuth: true,
  });
}
