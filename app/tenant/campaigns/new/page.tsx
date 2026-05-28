import { PageHeader } from '@/components/portal/PageHeader';
import { createAdminClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canManageEmailCampaigns } from '@/lib/tenant/campaignPermissions';
import { resolveCampaignAudience } from '@/lib/campaigns/resolveCampaignAudience';
import type { CampaignAudiencePreset } from '@/lib/campaigns/types';
import { CAMPAIGN_AUDIENCE_PRESET_LABEL } from '@/lib/campaigns/campaignDisplay';
import { CampaignForm } from '../CampaignForm';
import styles from '../campaigns.module.scss';
import Link from 'next/link';

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

  const audienceCounts = Object.fromEntries(
    await Promise.all(
      PRESETS.map(async (preset) => {
        const members = await resolveCampaignAudience({
          admin,
          tenantId: membership.tenantId,
          preset,
        });
        return [preset, members.length] as const;
      }),
    ),
  ) as Record<CampaignAudiencePreset, number>;

  return (
    <>
      <PageHeader
        title="New campaign"
        titleHint="Choose a template, audience, and message — then send to opted-in customers."
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
        readOnly={!canManage}
      />
    </>
  );
}
