import type { TenantRole } from '@/lib/auth/types';

export function canViewEmailCampaigns(_role: TenantRole): boolean {
  return true;
}

export function canManageEmailCampaigns(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin';
}
