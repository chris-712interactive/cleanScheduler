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
 *
 * `current` must be Auth `app_metadata.app_role`. `user_profiles.app_role` is not
 * a source: a member can attempt to write their own profile row.
 */
export function appRoleForTenantMember(current: AppRole | null | undefined): AppRole {
  if (current && isPlatformStaffRole(current)) return current;
  return appRoleForNewTenantMember();
}

/**
 * Platform role to store when a workspace membership role changes.
 * `profileAppRole` is accepted so callers and tests can show a self-written
 * profile value, and it is ignored.
 */
export function appRoleCopiedOnTenantRoleEdit(input: {
  authAppRole: AppRole | null | undefined;
  profileAppRole?: AppRole | null | undefined;
}): AppRole {
  void input.profileAppRole;
  return appRoleForTenantMember(input.authAppRole);
}
