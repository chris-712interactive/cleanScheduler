import type { TenantRole } from '@/lib/auth/types';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';

export function canReviewTimeOff(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function employeeCanRequestTimeOff(role: TenantRole): boolean {
  return isFieldEmployeeRole(role) || canReviewTimeOff(role);
}
