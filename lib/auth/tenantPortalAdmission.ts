import { isPlatformAdminRole } from '@/lib/auth/platformRoles';
import type { AppRole } from '@/lib/auth/types';

export type TenantPortalAdmission =
  { kind: 'masquerade' } | { kind: 'deny'; reason: 'membership' | 'unknown_tenant' };

/**
 * Decision for a signed-in user with no active membership on the host tenant.
 * Platform `admin` / `super_admin` is not enough. Cross-tenant entry requires
 * that role, a masquerade claim aimed at this tenant, and a live
 * `masquerade_sessions` row for that staff user and tenant. The claim is read
 * only from server-written app metadata. The session row is read with the
 * service role. `user_metadata` is not a session.
 */
export function decideTenantPortalAdmission(input: {
  appRole: AppRole | null;
  masqueradeTargetTenantId: string | null;
  /** Id of the tenant for the host slug, or null when that slug does not exist. */
  hostTenantId: string | null;
  /** True when the host slug was looked up. Unresolved hosts fail closed. */
  hostTenantResolved: boolean;
  /**
   * True when a service-role read found an open, unexpired masquerade_sessions
   * row for this staff user and the claimed target tenant.
   */
  hasLiveMasqueradeSession: boolean;
}): TenantPortalAdmission {
  const explicitSupport =
    isPlatformAdminRole(input.appRole) &&
    input.masqueradeTargetTenantId != null &&
    input.hasLiveMasqueradeSession;

  if (
    explicitSupport &&
    input.hostTenantId != null &&
    input.masqueradeTargetTenantId === input.hostTenantId
  ) {
    return { kind: 'masquerade' };
  }

  if (explicitSupport && input.hostTenantResolved && input.hostTenantId == null) {
    return { kind: 'deny', reason: 'unknown_tenant' };
  }

  return { kind: 'deny', reason: 'membership' };
}
