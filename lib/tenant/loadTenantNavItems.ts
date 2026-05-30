import { cache } from 'react';
import type { NavItem } from '@/components/portal/types';
import type { TenantRole } from '@/lib/auth/types';
import { isFeatureEnabled } from '@/lib/billing/entitlements';
import {
  getCachedOwnerOnboardingNavContext,
  getCachedPendingRescheduleCount,
} from '@/lib/portal/cachedNavChrome';
import { getTenantEntitlementPlan } from '@/lib/portal/requestContext';
import { buildTenantBillingNavItem } from '@/lib/tenant/buildTenantBillingNav';
import { buildTenantSettingsNavItem } from '@/lib/tenant/buildTenantSettingsNav';
import { buildTenantNavItems } from '@/lib/tenant/buildTenantNavItems';
import { needsSubscriptionPurchase } from '@/lib/billing/tenantSubscriptionAccess';
import type { TenantBillingSnapshot } from '@/lib/portal/requestContext';

export interface TenantNavShellParams {
  tenantId: string;
  tenantSlug: string;
  role: TenantRole;
  billingSnapshot: TenantBillingSnapshot;
}

/** Nav items with badges/onboarding — cached per request when called from multiple Suspense slots. */
export const loadTenantNavItemsForShell = cache(
  async ({
    tenantId,
    tenantSlug,
    role,
    billingSnapshot,
  }: TenantNavShellParams): Promise<NavItem[]> => {
    const subscriptionLocked = needsSubscriptionPurchase(billingSnapshot.subscriptionAccess);
    const connectStatus = billingSnapshot.connectStatus;

    const [pendingRescheduleCount, planTier, onboarding] = await Promise.all([
      getCachedPendingRescheduleCount(tenantId),
      getTenantEntitlementPlan(tenantId),
      subscriptionLocked
        ? Promise.resolve({ gettingStartedNavItem: null, coreSetupComplete: true })
        : getCachedOwnerOnboardingNavContext({
            tenantId,
            tenantSlug,
            role,
            connectStatus,
          }),
    ]);

    return buildTenantNavItems({
      role,
      subscriptionLocked,
      billingNavItem: buildTenantBillingNavItem(),
      settingsNavItem: buildTenantSettingsNavItem(),
      campaignsNavEnabled: isFeatureEnabled(planTier, 'campaigns'),
      pendingRescheduleCount,
      gettingStartedNavItem: onboarding.gettingStartedNavItem,
    });
  },
);
