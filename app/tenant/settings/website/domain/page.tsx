import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import {
  canUsePaidSubscriptionFeatures,
  type TenantBillingStatus,
} from '@/lib/billing/tenantSubscriptionAccess';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { WebsiteDomainPanel } from '../WebsiteDomainPanel';
import type { TenantPublicDomainSiteMode } from '@/lib/tenantSite/types';

export const dynamic = 'force-dynamic';

export default async function TenantWebsiteDomainSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/website/domain');
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);

  const customDomainEnabled = isFeatureEnabled(plan, 'tenantMarketingSiteCustomDomain');
  const [{ data: billing }, { data: domain }] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('status')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    admin
      .from('tenant_customer_portal_domains')
      .select('hostname, status, site_mode')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
  ]);

  const paid = canUsePaidSubscriptionFeatures(
    (billing?.status ?? 'trialing') as TenantBillingStatus,
  );
  const allowed = customDomainEnabled && paid;

  return (
    <>
      <PageHeader
        title="Website domain"
        titleHint="Use one custom domain for your public website and customer portal."
        backHref="/settings/website"
        backLabel="Website"
      />

      <Stack gap={6}>
        {!allowed ? (
          <FeatureUpgradePanel
            title="Upgrade for unified custom domain"
            description={`${minimumTierLabelForFeature('tenantMarketingSiteCustomDomain')} plans can serve your marketing website at / and your customer portal at /portal on the same domain.`}
          />
        ) : (
          <WebsiteDomainPanel
            tenantSlug={membership.tenantSlug}
            domainActive={domain?.status === 'active'}
            siteMode={(domain?.site_mode as TenantPublicDomainSiteMode) ?? 'portal_only'}
            hostname={domain?.hostname ?? null}
          />
        )}
      </Stack>
    </>
  );
}
