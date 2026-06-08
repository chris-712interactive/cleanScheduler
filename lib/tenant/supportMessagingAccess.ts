import type { TenantRole } from '@/lib/auth/types';

export function canReplyToSupportThreads(role: TenantRole): boolean {
  return role !== 'viewer';
}
