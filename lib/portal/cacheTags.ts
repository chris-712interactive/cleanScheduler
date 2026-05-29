/** Next.js cache tags for portal nav chrome (see docs/performance/interaction-latency-plan.md). */

export function tenantNavBadgesTag(tenantId: string): string {
  return `tenant-nav-badges:${tenantId}`;
}

export function tenantOnboardingTag(tenantId: string): string {
  return `tenant-onboarding:${tenantId}`;
}

export function tenantUsageTag(tenantId: string): string {
  return `tenant-usage:${tenantId}`;
}

export function customerQuoteBadgeTag(customerId: string): string {
  return `customer-quote-badge:${customerId}`;
}

export function customerIdsCacheKey(customerIds: string[]): string {
  if (customerIds.length === 0) return '';
  return [...customerIds].sort().join(',');
}
