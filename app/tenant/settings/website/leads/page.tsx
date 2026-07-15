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
  const bookingEnabled = isFeatureEnabled(plan, 'publicBookingRequest');
  const leadsAccess = websiteEnabled || bookingEnabled;

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

  const leads = leadsAccess ? await loadTenantMarketingLeads(admin, membership.tenantId) : [];
  const showLeads =
    leadsAccess && (bookingEnabled || Boolean(settingsRow?.is_published) || websiteEnabled);

  return (
    <>
      <PageHeader
        title="Leads"
        titleHint="Quote requests and contact form submissions from your public forms."
        backHref={websiteEnabled ? '/settings/website' : '/settings/booking-requests'}
        backLabel={websiteEnabled ? 'Website' : 'Booking requests'}
        actions={
          leadsAccess ? (
            <Link
              href={websiteEnabled ? '/settings/website' : '/settings/booking-requests'}
              className={styles.inlineLink}
            >
              {websiteEnabled ? 'Website settings' : 'Booking form'}
            </Link>
          ) : undefined
        }
      />

      <Stack gap={6}>
        {!leadsAccess ? (
          <FeatureUpgradePanel
            title="Upgrade to capture leads"
            description={`Upgrade to ${minimumTierLabelForFeature('publicBookingRequest')} to collect booking requests, or ${minimumTierLabelForFeature('tenantMarketingSite')} for a full marketing website.`}
          />
        ) : !showLeads ? (
          <p className={styles.readOnlyNotice} role="status">
            Publish your website or enable the booking request form to start receiving leads.{' '}
            <Link href="/settings/booking-requests" className={styles.inlineLink}>
              Booking requests
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
