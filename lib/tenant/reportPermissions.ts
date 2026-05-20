import type { TenantRole } from '@/lib/auth/types';

export function canExportReports(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin';
}
