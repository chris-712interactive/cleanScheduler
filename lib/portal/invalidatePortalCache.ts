import { updateTag } from 'next/cache';
import {
  customerQuoteBadgeTag,
  tenantNavBadgesTag,
  tenantOnboardingTag,
  tenantUsageTag,
} from '@/lib/portal/cacheTags';

/** Invalidate cached portal nav chrome (server actions only — uses `updateTag`). */

export function invalidateTenantNavBadges(tenantId: string): void {
  updateTag(tenantNavBadgesTag(tenantId));
}

export function invalidateTenantOnboarding(tenantId: string): void {
  updateTag(tenantOnboardingTag(tenantId));
}

export function invalidateTenantUsage(tenantId: string): void {
  updateTag(tenantUsageTag(tenantId));
}

export function invalidateCustomerQuoteBadge(customerId: string): void {
  if (!customerId) return;
  updateTag(customerQuoteBadgeTag(customerId));
}
