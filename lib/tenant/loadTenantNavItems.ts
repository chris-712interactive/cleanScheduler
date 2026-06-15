import { cache } from 'react';
import type { NavItem } from '@/components/portal/types';
import type { TenantRole } from '@/lib/auth/types';
import { isFeatureEnabled } from '@/lib/billing/entitlements';
import {
  getCachedOwnerOnboardingNavContext,
  getCachedOpenSupportThreadCount,
  getCachedPendingRescheduleCount,
} from '@/lib/portal/cachedNavChrome';
import { getTenantEntitlementPlan } from '@/lib/portal/requestContext';
import { buildTenantBillingNavItem } from '@/lib/tenant/buildTenantBillingNav';
import { buildTenantSettingsNavItem } from '@/lib/tenant/buildTenantSettingsNav';
import {
  buildTenantWebsiteNavItems,
  countNewTenantMarketingLeads,
} from '@/lib/tenant/buildTenantWebsiteNav';
import { buildTenantNavItems } from '@/lib/tenant/buildTenantNavItems';
import { needsSubscriptionPurchase } from '@/lib/billing/tenantSubscriptionAccess';
import type { TenantBillingSnapshot } from '@/lib/portal/requestContext';
import {
  countPendingReferralAttributions,
  tenantReferralsNavEnabled,
} from '@/lib/referrals/tenantReferralsNav';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveMembershipPermissions } from '@/lib/tenant/resolveMembershipPermissions';

export interface TenantNavShellParams {
  tenantId: string;
  tenantSlug: string;
  role: TenantRole;
  roleId?: string | null;
  billingSnapshot: TenantBillingSnapshot;
}

/** Nav items with badges/onboarding — cached per request when called from multiple Suspense slots. */
export const loadTenantNavItemsForShell = cache(
  async ({
    tenantId,
    tenantSlug,
    role,
    roleId = null,
    billingSnapshot,
  }: TenantNavShellParams): Promise<NavItem[]> => {
    const subscriptionLocked = needsSubscriptionPurchase(billingSnapshot.subscriptionAccess);
    const connectStatus = billingSnapshot.connectStatus;

    const admin = createAdminClient();
    const planTier = await getTenantEntitlementPlan(tenantId);
    const websiteFeatureEnabled = isFeatureEnabled(planTier, 'tenantMarketingSite');

    const [
      pendingRescheduleCount,
      openSupportThreadCount,
      onboarding,
      referralsEnabled,
      siteSettings,
    ] = await Promise.all([
      getCachedPendingRescheduleCount(tenantId),
      getCachedOpenSupportThreadCount(tenantId),
      subscriptionLocked
        ? Promise.resolve({ gettingStartedNavItem: null, coreSetupComplete: true })
        : getCachedOwnerOnboardingNavContext({
            tenantId,
            tenantSlug,
            role,
            connectStatus,
          }),
      tenantReferralsNavEnabled(admin, tenantId),
      websiteFeatureEnabled
        ? admin
            .from('tenant_marketing_site_settings')
            .select('is_published')
            .eq('tenant_id', tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const websitePublished = siteSettings.data?.is_published ?? false;
    const newLeadsCount =
      websiteFeatureEnabled && websitePublished
        ? await countNewTenantMarketingLeads(admin, tenantId)
        : 0;

    const websiteNavItems = buildTenantWebsiteNavItems({
      websiteEnabled: websiteFeatureEnabled,
      websitePublished,
      newLeadsCount,
    });

    const pendingReferralCount = referralsEnabled
      ? await countPendingReferralAttributions(admin, tenantId)
      : 0;

    const permissions = await resolveMembershipPermissions(admin, {
      tenantId,
      role,
      roleId,
    });

    return buildTenantNavItems({
      role,
      permissions,
      subscriptionLocked,
      billingNavItem: buildTenantBillingNavItem(),
      settingsNavItem: buildTenantSettingsNavItem(),
      websiteNavItems,
      campaignsNavEnabled: isFeatureEnabled(planTier, 'campaigns'),
      referralsNavEnabled: referralsEnabled,
      pendingRescheduleCount,
      openSupportThreadCount,
      pendingReferralCount,
      gettingStartedNavItem: onboarding.gettingStartedNavItem,
    });
  },
);
