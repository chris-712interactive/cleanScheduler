import type { TenantRole } from '@/lib/auth/types';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';

/** Owner and admin can open and reply to platform support tickets. */
export function canManagePlatformSupportTickets(role: TenantRole): boolean {
  return hasMinimumTenantRole(role, 'admin');
}
