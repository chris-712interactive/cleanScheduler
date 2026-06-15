import type { EntitlementPlanKey } from '@/lib/billing/entitlements';
import {
  canUsePaidSubscriptionFeatures,
  type TenantBillingStatus,
} from '@/lib/billing/tenantSubscriptionAccess';

/** Whether tenant marketing pages should be indexable by search engines. */
export function isTenantSiteIndexable(options: {
  plan: EntitlementPlanKey;
  billingStatus: TenantBillingStatus;
  isPublished: boolean;
}): boolean {
  if (options.plan === 'trial') return false;
  if (!options.isPublished) return false;
  return canUsePaidSubscriptionFeatures(options.billingStatus);
}
