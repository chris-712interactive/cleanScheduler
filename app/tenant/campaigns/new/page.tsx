import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { createAdminClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canManageEmailCampaigns } from '@/lib/tenant/campaignPermissions';
import { resolveCampaignAudience } from '@/lib/campaigns/resolveCampaignAudience';
import { campaignPreviewBrandingFromTenant } from '@/lib/campaigns/campaignPreviewBranding';
import type { CampaignAudiencePreset } from '@/lib/campaigns/types';
import { CAMPAIGN_AUDIENCE_PRESET_LABEL } from '@/lib/campaigns/campaignDisplay';
import { getCustomerPortalOriginForTenant } from '@/lib/portal/customerPortalOrigin';
import { CampaignForm } from '../CampaignForm';
import styles from '../campaigns.module.scss';

export const dynamic = 'force-dynamic';

const PRESETS = Object.keys(CAMPAIGN_AUDIENCE_PRESET_LABEL) as CampaignAudiencePreset[];

export default async function NewCampaignPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/campaigns/new');
  const canManage = canManageEmailCampaigns(membership.role);

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);

  if (!isFeatureEnabled(tier, 'campaigns')) {
    return (
      <>
        <PageHeader title="New campaign" backHref="/campaigns" backLabel="Campaigns" />
        <div className={styles.upgradePanel}>
          <h2 className={styles.upgradeTitle}>Upgrade to unlock email campaigns</h2>
          <p className={styles.upgradeCopy}>
            Business and Pro plans include promotional email campaigns with performance metrics.
          </p>
          <Link href="/billing" className={styles.upgradeLink}>
            View workspace billing
          </Link>
        </div>
      </>
    );
  }

  const [{ data: tenant }, portalOrigin, audienceCountsEntries] = await Promise.all([
    admin
      .from('tenants')
      .select('name, brand_color, logo_url, address_line1, city, state, postal_code')
      .eq('id', membership.tenantId)
      .maybeSingle(),
    getCustomerPortalOriginForTenant(admin, membership.tenantId),
    Promise.all(
      PRESETS.map(async (preset) => {
        const members = await resolveCampaignAudience({
          admin,
          tenantId: membership.tenantId,
          preset,
        });
        return [preset, members.length] as const;
      }),
    ),
  ]);

  const audienceCounts = Object.fromEntries(audienceCountsEntries) as Record<
    CampaignAudiencePreset,
    number
  >;

  const previewBranding = campaignPreviewBrandingFromTenant(
    tenant ?? {
      name: membership.tenantSlug,
      brand_color: null,
      logo_url: null,
      address_line1: null,
      city: null,
      state: null,
      postal_code: null,
    },
    `${portalOrigin}/`,
  );

  return (
    <>
      <PageHeader
        title="New campaign"
        titleHint="Pick a template, personalize your message with variables, preview it, then send to opted-in customers."
        backHref="/campaigns"
        backLabel="Campaigns"
      />

      {!canManage ? (
        <p className={styles.readOnlyNotice} role="status">
          Only owners and admins can create and send campaigns.
        </p>
      ) : null}

      <CampaignForm
        tenantSlug={membership.tenantSlug}
        audienceCounts={audienceCounts}
        previewBranding={previewBranding}
        readOnly={!canManage}
      />
    </>
  );
}
