import type { AppRole } from '@/lib/auth/types';

export const PLATFORM_ADMIN_ROLES: AppRole[] = ['super_admin', 'admin'];
export const PLATFORM_STAFF_ROLES: AppRole[] = ['super_admin', 'admin', 'sales'];

export function isPlatformAdminRole(role: AppRole | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function isPlatformStaffRole(role: AppRole | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'sales';
}

export function isPlatformSalesRole(role: AppRole | null | undefined): boolean {
  return role === 'sales';
}
