import { isPlatformStaffRole } from '@/lib/auth/platformRoles';
import type { AppRole } from '@/lib/auth/types';

/**
 * Platform role stored for a workspace member.
 * Owner, tenant admin, employee, and viewer authority lives on
 * `tenant_memberships.role`, not on this value.
 */
export function appRoleForNewTenantMember(): Extract<AppRole, 'employee'> {
  return 'employee';
}

/**
 * Invite links and tenant role edits must not promote someone into platform staff.
 * An account that is already platform staff keeps that platform role.
 */
export function appRoleForTenantMember(current: AppRole | null | undefined): AppRole {
  if (current && isPlatformStaffRole(current)) return current;
  return appRoleForNewTenantMember();
}
