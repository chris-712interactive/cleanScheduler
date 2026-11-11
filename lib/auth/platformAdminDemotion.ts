const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Platform labels a tenant member must not keep unless their user id is on the
 * staff allowlist. Includes `super_admin` and `sales` because a self-written
 * profile role could be copied into both the profile and Auth.
 */
export const MISLABELED_TENANT_PLATFORM_ROLES = ['admin', 'super_admin', 'sales'] as const;

export function isMislabeledTenantPlatformRole(
  role: string | null | undefined,
): role is (typeof MISLABELED_TENANT_PLATFORM_ROLES)[number] {
  return role === 'admin' || role === 'super_admin' || role === 'sales';
}

/**
 * How a demotion run treats Auth `app_metadata.app_role`.
 * Staff labels are rewritten to employee. Any other value is left unchanged.
 * The profile label is still cleared by the caller, including when Auth is unrecognized.
 */
export function demoteAuthAppRole(authRole: string | null | undefined): {
  nextAuthRole: 'employee' | null;
  authRoleUnrecognized: boolean;
} {
  if (isMislabeledTenantPlatformRole(authRole)) {
    return { nextAuthRole: 'employee', authRoleUnrecognized: false };
  }
  const recognized = !authRole || authRole === 'employee' || authRole === 'customer';
  return { nextAuthRole: null, authRoleUnrecognized: !recognized };
}

/**
 * Parses a required staff allowlist. Returns null when the value is missing,
 * empty, or contains anything that is not a user id. An unusable allowlist
 * must not demote anyone.
 */
export function parseStaffAllowlist(raw: string | null | undefined): Set<string> | null {
  if (!raw || !raw.trim()) return null;
  const ids = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  if (ids.length === 0) return null;
  if (!ids.every((id) => USER_ID.test(id))) return null;
  return new Set(ids);
}

/**
 * Demote a platform label only when the user has a tenant membership and is
 * not on the staff allowlist. Membership includes inactive rows so a
 * deactivated account that copied a platform role is still eligible.
 * Platform staff with no membership stay. An empty allowlist demotes nobody.
 */
export function shouldDemoteMislabeledPlatformAdmin(input: {
  appRole: string | null;
  hasTenantMembership: boolean;
  userId: string;
  allowlist: ReadonlySet<string>;
}): boolean {
  if (input.allowlist.size === 0) return false;
  const userId = input.userId.trim().toLowerCase();
  if (!userId || input.allowlist.has(userId)) return false;
  if (!isMislabeledTenantPlatformRole(input.appRole)) return false;
  return input.hasTenantMembership;
}
