import { isPlatformAdminRole } from '@/lib/auth/platformRoles';
import type { AppRole } from '@/lib/auth/types';

export type TenantPortalAdmission =
  { kind: 'masquerade' } | { kind: 'deny'; reason: 'membership' | 'unknown_tenant' };

/**
 * Decision for a signed-in user with no active membership on the host tenant.
 * Platform `admin` / `super_admin` is not enough. Cross-tenant entry requires
 * that role plus a masquerade claim aimed at this tenant. The claim is read
 * only from server-written app metadata.
 */
export function decideTenantPortalAdmission(input: {
  appRole: AppRole | null;
  masqueradeTargetTenantId: string | null;
  /** Id of the tenant for the host slug, or null when that slug does not exist. */
  hostTenantId: string | null;
  /** True when the host slug was looked up. Unresolved hosts fail closed. */
  hostTenantResolved: boolean;
}): TenantPortalAdmission {
  const explicitSupport =
    isPlatformAdminRole(input.appRole) && input.masqueradeTargetTenantId != null;

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
