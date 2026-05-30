import { ConnectStatusBanner } from '@/components/billing/ConnectStatusBanner';
import { UsageUtilizationBanner } from '@/components/billing/UsageUtilizationBanner';
import type { TenantStripeConnectStatus } from '@/components/billing/ConnectStatusBanner';
import type { TenantRole } from '@/lib/auth/types';
import { needsSubscriptionPurchase } from '@/lib/billing/tenantSubscriptionAccess';
import {
  getCachedOwnerOnboardingNavContext,
  getCachedTenantUsageUtilizationAlert,
} from '@/lib/portal/cachedNavChrome';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';

export interface TenantDeferredSessionNoticesProps {
  tenantId: string;
  tenantSlug: string;
  role: TenantRole;
  connectStatus: string | null;
  subscriptionAccess: Parameters<typeof needsSubscriptionPurchase>[0];
}

/** Banners that depend on onboarding/usage data — streamed after the shell paints. */
export async function TenantDeferredSessionNotices({
  tenantId,
  tenantSlug,
  role,
  connectStatus,
  subscriptionAccess,
}: TenantDeferredSessionNoticesProps) {
  const subscriptionLocked = needsSubscriptionPurchase(subscriptionAccess);
  if (subscriptionLocked || isFieldEmployeeRole(role)) {
    return null;
  }

  const [onboarding, usageUtilizationAlert] = await Promise.all([
    getCachedOwnerOnboardingNavContext({
      tenantId,
      tenantSlug,
      role,
      connectStatus,
    }),
    getCachedTenantUsageUtilizationAlert(tenantId),
  ]);

  const notices = [];
  const status = (connectStatus ?? 'not_started') as TenantStripeConnectStatus;

  if (onboarding.coreSetupComplete && status !== 'complete') {
    notices.push(<ConnectStatusBanner key="connect" status={status} />);
  }

  if (usageUtilizationAlert) {
    notices.push(<UsageUtilizationBanner key="usage" alert={usageUtilizationAlert} />);
  }

  if (notices.length === 0) return null;
  return <>{notices}</>;
}
