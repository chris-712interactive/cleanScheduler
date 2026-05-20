import type { TenantRole } from '@/lib/auth/types';

/** Short role label for the team table Role column. */
export function teamRoleLabel(role: TenantRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  if (role === 'employee') return 'Employee';
  if (role === 'viewer') return 'Viewer';
  return role;
}

export function teamMemberStatusLabel(isActive: boolean): string {
  return isActive ? 'Active' : 'Inactive';
}
