import type { TenantRole } from '@/lib/auth/types';
import {
  defaultPermissionsForSystemRole,
  type PermissionKey,
} from '@/lib/tenant/permissionCatalog';
import { hasPermission } from '@/lib/tenant/resolveMembershipPermissions';

export function canReplyToSupportThreads(
  roleOrPermissions: TenantRole | ReadonlySet<PermissionKey>,
): boolean {
  if (typeof roleOrPermissions === 'string') {
    return defaultPermissionsForSystemRole(roleOrPermissions).has('messages.reply');
  }
  return hasPermission(roleOrPermissions, 'messages.reply');
}
