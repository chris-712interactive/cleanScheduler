import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canManageEmailCampaigns } from '@/lib/tenant/campaignPermissions';
import {
  CAMPAIGN_AUDIENCE_PRESET_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_TEMPLATE_LABEL,
  campaignStatusTone,
  formatCampaignRate,
} from '@/lib/campaigns/campaignDisplay';
import { campaignPreviewBrandingFromTenant } from '@/lib/campaigns/campaignPreviewBranding';
import { resolveCampaignAudience } from '@/lib/campaigns/resolveCampaignAudience';
import type {
  CampaignAudiencePreset,
  CampaignStatus,
  CampaignTemplateKey,
} from '@/lib/campaigns/types';
import { getCustomerPortalOriginForTenant } from '@/lib/portal/customerPortalOrigin';
import { CampaignEmailPreview } from '../CampaignEmailPreview';
import { CampaignForm } from '../CampaignForm';
import { SendCampaignButton } from '../SendCampaignButton';
import styles from '../campaigns.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; saved?: string }>;
}

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/campaigns/${id}`);
  const canManage = canManageEmailCampaigns(membership.role);

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  if (!isFeatureEnabled(tier, 'campaigns')) {
    notFound();
  }

  const supabase = createTenantPortalDbClient();
  const [{ data: campaign, error }, { data: recipients }, { data: tenant }, portalOrigin] =
    await Promise.all([
      supabase
        .from('tenant_email_campaigns')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', membership.tenantId)
        .maybeSingle(),
      supabase
        .from('tenant_email_campaign_recipients')
        .select('email, status, opened_at, clicked_at, sent_at')
        .eq('campaign_id', id)
        .eq('tenant_id', membership.tenantId)
        .order('email', { ascending: true })
        .limit(50),
      admin
        .from('tenants')
        .select('name, brand_color, logo_url, address_line1, city, state, postal_code')
        .eq('id', membership.tenantId)
        .maybeSingle(),
      getCustomerPortalOriginForTenant(admin, membership.tenantId),
    ]);

  if (error || !campaign) {
    notFound();
  }

  const delivered = campaign.delivered_count || campaign.sent_count || 0;
  const isDraft = campaign.status === 'draft';
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

  const fullAudienceCounts = isDraft
    ? (Object.fromEntries(
        await Promise.all(
          (
            [
              'all_marketable',
              'email_preferred',
              'residential',
              'portal_nudge',
              'open_balance',
            ] as CampaignAudiencePreset[]
          ).map(async (preset) => {
            const members = await resolveCampaignAudience({
              admin,
              tenantId: membership.tenantId,
              preset,
            });
            return [preset, members.length] as const;
          }),
        ),
      ) as Record<CampaignAudiencePreset, number>)
    : ({} as Record<CampaignAudiencePreset, number>);

  return (
    <>
      <PageHeader
        title={campaign.name}
        titleHint={campaign.subject}
        backHref="/campaigns"
        backLabel="Campaigns"
        actions={
          canManage && isDraft ? (
            <SendCampaignButton tenantSlug={membership.tenantSlug} campaignId={campaign.id} />
          ) : undefined
        }
      />

      {sp?.sent === '1' ? (
        <p className={styles.bannerOk} role="status">
          Campaign sent. Metrics will update as recipients open and click your email.
        </p>
      ) : null}
      {sp?.saved === '1' ? (
        <p className={styles.bannerOk} role="status">
          Draft saved.
        </p>
      ) : null}

      {!isDraft ? (
        <div className={styles.detailGrid}>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Sent</p>
            <p className={styles.metricValue}>{campaign.sent_count}</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Delivered</p>
            <p className={styles.metricValue}>{campaign.delivered_count || campaign.sent_count}</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Open rate</p>
            <p className={styles.metricValue}>
              {formatCampaignRate(campaign.opened_count, delivered)}
            </p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Click rate</p>
            <p className={styles.metricValue}>
              {formatCampaignRate(campaign.clicked_count, delivered)}
            </p>
          </div>
        </div>
      ) : null}

      <section className={styles.detailCard}>
        <h2 className={styles.detailCardTitle}>Overview</h2>
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Status</dt>
            <dd className={styles.detailValue}>
              <StatusPill tone={campaignStatusTone(campaign.status as CampaignStatus)}>
                {CAMPAIGN_STATUS_LABEL[campaign.status as CampaignStatus]}
              </StatusPill>
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Template</dt>
            <dd className={styles.detailValue}>
              {
                CAMPAIGN_TEMPLATE_LABEL[
                  campaign.template_key as keyof typeof CAMPAIGN_TEMPLATE_LABEL
                ]
              }
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Audience</dt>
            <dd className={styles.detailValue}>
              {CAMPAIGN_AUDIENCE_PRESET_LABEL[campaign.audience_preset as CampaignAudiencePreset]}
              {isDraft
                ? ` (${fullAudienceCounts[campaign.audience_preset as CampaignAudiencePreset]} recipients)`
                : null}
            </dd>
          </div>
          {!isDraft ? (
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Recipients</dt>
              <dd className={styles.detailValue}>{campaign.recipient_count}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {isDraft && canManage ? (
        <CampaignForm
          tenantSlug={membership.tenantSlug}
          audienceCounts={fullAudienceCounts}
          previewBranding={previewBranding}
          campaignId={campaign.id}
          initialValues={{
            name: campaign.name,
            subject: campaign.subject,
            templateKey: campaign.template_key as CampaignTemplateKey,
            bodyText: campaign.body_text,
            bodyHtml: campaign.body_html ?? '',
            audiencePreset: campaign.audience_preset as CampaignAudiencePreset,
          }}
        />
      ) : (
        <CampaignEmailPreview
          subject={campaign.subject}
          bodyText={campaign.body_text}
          bodyHtml={campaign.body_html ?? ''}
          templateKey={campaign.template_key as CampaignTemplateKey}
          branding={previewBranding}
        />
      )}

      {!isDraft ? (
        <section className={styles.detailCard}>
          <h2 className={styles.detailCardTitle}>Recipients</h2>
          {(recipients ?? []).length === 0 ? (
            <p className={styles.empty}>No recipients yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.directoryTable}>
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Status</th>
                    <th scope="col">Opened</th>
                    <th scope="col">Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {(recipients ?? []).map((row) => (
                    <tr key={row.email}>
                      <td>{row.email}</td>
                      <td>{row.status}</td>
                      <td>{row.opened_at ? 'Yes' : '—'}</td>
                      <td>{row.clicked_at ? 'Yes' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
