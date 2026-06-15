import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { ensureTenantMarketingSiteSeeded } from '@/lib/tenantSite/seedTenantSite';
import { loadTenantMarketingLeads } from '@/lib/tenantSite/loadTenantSiteData';
import { WebsiteLeadsPanel } from '../WebsiteLeadsPanel';
import styles from '../website-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantWebsiteLeadsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/website/leads');
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  const websiteEnabled = isFeatureEnabled(plan, 'tenantMarketingSite');

  if (websiteEnabled) {
    await ensureTenantMarketingSiteSeeded(admin, membership.tenantId);
  }

  const { data: settingsRow } = websiteEnabled
    ? await admin
        .from('tenant_marketing_site_settings')
        .select('is_published')
        .eq('tenant_id', membership.tenantId)
        .maybeSingle()
    : { data: null };

  const leads = websiteEnabled ? await loadTenantMarketingLeads(admin, membership.tenantId) : [];

  return (
    <>
      <PageHeader
        title="Leads"
        titleHint="Contact form submissions from your public marketing website."
        backHref="/settings/website"
        backLabel="Website"
        actions={
          websiteEnabled ? (
            <Link href="/settings/website" className={styles.inlineLink}>
              Website settings
            </Link>
          ) : undefined
        }
      />

      <Stack gap={6}>
        {!websiteEnabled ? (
          <FeatureUpgradePanel
            title="Upgrade to capture website leads"
            description={`Upgrade to ${minimumTierLabelForFeature('tenantMarketingSite')} to collect inbound leads from your public site.`}
          />
        ) : !settingsRow?.is_published ? (
          <p className={styles.readOnlyNotice} role="status">
            Publish your website to start receiving leads.{' '}
            <Link href="/settings/website" className={styles.inlineLink}>
              Go to website settings
            </Link>
          </p>
        ) : (
          <WebsiteLeadsPanel
            tenantSlug={membership.tenantSlug}
            leads={leads.map((lead) => ({
              id: lead.id,
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              message: lead.message,
              status: lead.status,
              createdAt: lead.created_at,
            }))}
          />
        )}
      </Stack>
    </>
  );
}
