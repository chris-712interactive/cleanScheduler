import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
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
import type { CampaignAudiencePreset, CampaignStatus } from '@/lib/campaigns/types';
import { SendCampaignButton } from '../SendCampaignButton';
import styles from '../campaigns.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
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
  const [{ data: campaign, error }, { data: recipients }] = await Promise.all([
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
  ]);

  if (error || !campaign) {
    notFound();
  }

  const delivered = campaign.delivered_count || campaign.sent_count || 0;

  return (
    <>
      <PageHeader
        title={campaign.name}
        titleHint={campaign.subject}
        backHref="/campaigns"
        backLabel="Campaigns"
        actions={
          canManage && campaign.status === 'draft' ? (
            <SendCampaignButton tenantSlug={membership.tenantSlug} campaignId={campaign.id} />
          ) : undefined
        }
      />

      {sp?.sent === '1' ? (
        <p className={styles.bannerOk} role="status">
          Campaign sent. Metrics will update as recipients open and click your email.
        </p>
      ) : null}

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
          <p className={styles.metricValue}>{formatCampaignRate(campaign.opened_count, delivered)}</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Click rate</p>
          <p className={styles.metricValue}>{formatCampaignRate(campaign.clicked_count, delivered)}</p>
        </div>
      </div>

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
              {CAMPAIGN_TEMPLATE_LABEL[campaign.template_key as keyof typeof CAMPAIGN_TEMPLATE_LABEL]}
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Audience</dt>
            <dd className={styles.detailValue}>
              {CAMPAIGN_AUDIENCE_PRESET_LABEL[campaign.audience_preset as CampaignAudiencePreset]}
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Recipients</dt>
            <dd className={styles.detailValue}>{campaign.recipient_count}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Message</dt>
            <dd className={styles.detailValue}>{campaign.body_text || '—'}</dd>
          </div>
        </dl>
      </section>

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

      <Link href="/campaigns">
        <Button variant="secondary">Back to campaigns</Button>
      </Link>
    </>
  );
}
