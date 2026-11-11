const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Tenant users were stamped with platform `admin`. Demote that label only
 * when the user has a tenant membership and is not on the staff allowlist.
 * `super_admin` and `sales` stay. Platform admins with no membership stay.
 * An empty allowlist demotes nobody.
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
  if (input.appRole !== 'admin') return false;
  return input.hasTenantMembership;
}
