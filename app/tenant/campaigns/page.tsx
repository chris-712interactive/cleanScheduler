import Link from 'next/link';
import { ChevronLeft, ChevronRight, Mail, MousePointerClick, Send, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { DashboardStatCard } from '@/app/tenant/DashboardStatCard';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  isFeatureEnabled,
  resolveTenantPlanTier,
} from '@/lib/billing/entitlements';
import { canManageEmailCampaigns } from '@/lib/tenant/campaignPermissions';
import {
  CAMPAIGN_AUDIENCE_PRESET_LABEL,
  CAMPAIGN_STATUS_LABEL,
  campaignStatusTone,
  formatCampaignRate,
} from '@/lib/campaigns/campaignDisplay';
import {
  buildCampaignSearchParams,
  CAMPAIGN_PAGE_SIZE,
  parseCampaignPage,
  parseCampaignStatusFilter,
} from '@/lib/campaigns/campaignPaging';
import type { CampaignAudiencePreset, CampaignStatus } from '@/lib/campaigns/types';
import styles from './campaigns.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export default async function TenantCampaignsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = parseCampaignStatusFilter(firstParam(sp?.status));
  const currentPage = parseCampaignPage(firstParam(sp?.page));

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/campaigns');
  const canManage = canManageEmailCampaigns(membership.role);

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const campaignsEnabled = isFeatureEnabled(tier, 'campaigns');

  if (!campaignsEnabled) {
    return (
      <>
        <PageHeader
          title="Campaigns"
          titleHint="Email campaigns to your customers."
        />
        <div className={styles.upgradePanel}>
          <h2 className={styles.upgradeTitle}>Upgrade to unlock email campaigns</h2>
          <p className={styles.upgradeCopy}>
            Audience selection, branded sends, and open/click metrics are included on Business and
            Pro plans.
          </p>
          <Link href="/billing" className={styles.upgradeLink}>
            View workspace billing
          </Link>
        </div>
      </>
    );
  }

  const supabase = createTenantPortalDbClient();
  let query = supabase
    .from('tenant_email_campaigns')
    .select('*')
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: campaigns, error } = await query;
  if (error) {
    return (
      <>
        <PageHeader title="Campaigns" titleHint="Email campaigns to your customers." />
        <p className={styles.formError} role="alert">
          Could not load campaigns ({error.message}).
        </p>
      </>
    );
  }

  const rows = campaigns ?? [];
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CAMPAIGN_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * CAMPAIGN_PAGE_SIZE;
  const pageRows = rows.slice(start, start + CAMPAIGN_PAGE_SIZE);

  const monthCampaigns = rows.filter(
    (row) => row.status === 'sent' && row.sent_at && row.sent_at >= monthStartIso(),
  );
  const emailsSent30d = monthCampaigns.reduce((sum, row) => sum + (row.sent_count ?? 0), 0);
  const opens30d = monthCampaigns.reduce((sum, row) => sum + (row.opened_count ?? 0), 0);
  const clicks30d = monthCampaigns.reduce((sum, row) => sum + (row.clicked_count ?? 0), 0);
  const delivered30d = monthCampaigns.reduce((sum, row) => sum + (row.delivered_count || row.sent_count || 0), 0);
  const activeCount = rows.filter((row) => row.status === 'sending' || row.status === 'draft').length;

  const tabLinks = [
    { key: 'all' as const, label: 'All' },
    { key: 'draft' as const, label: 'Draft' },
    { key: 'sending' as const, label: 'Sending' },
    { key: 'sent' as const, label: 'Sent' },
    { key: 'failed' as const, label: 'Failed' },
  ];

  return (
    <>
      <PageHeader
        title="Campaigns"
        titleHint="Email campaigns to your customers."
        actions={
          canManage ? (
            <Button variant="primary" as="a" href="/campaigns/new">
              New campaign
            </Button>
          ) : undefined
        }
      />

      <div className={styles.statGrid}>
        <DashboardStatCard
          icon={<Send size={20} />}
          label="Active campaigns"
          value={activeCount}
          badge={`${rows.filter((r) => r.status === 'sending').length} sending`}
          badgeTone="brand"
          actionLabel="View all"
          actionHref="/campaigns"
        />
        <DashboardStatCard
          icon={<Mail size={20} />}
          label="Emails sent (30d)"
          value={emailsSent30d}
          badge="Marketing sends"
          badgeTone="muted"
          actionLabel="Open campaigns"
          actionHref="/campaigns?status=sent"
        />
        <DashboardStatCard
          icon={<TrendingUp size={20} />}
          label="Open rate (30d)"
          value={formatCampaignRate(opens30d, delivered30d)}
          badge={`${opens30d} opens`}
          badgeTone="brand"
          actionLabel="View sent"
          actionHref="/campaigns?status=sent"
        />
        <DashboardStatCard
          icon={<MousePointerClick size={20} />}
          label="Click rate (30d)"
          value={formatCampaignRate(clicks30d, delivered30d)}
          badge={`${clicks30d} clicks`}
          badgeTone="brand"
          actionLabel="View sent"
          actionHref="/campaigns?status=sent"
        />
      </div>

      <nav className={styles.directoryTabs} aria-label="Campaign filters">
        {tabLinks.map((tab) => (
          <Link
            key={tab.key}
            href={`/campaigns${buildCampaignSearchParams({ status: tab.key })}`}
            className={styles.directoryTab}
            data-active={statusFilter === tab.key || undefined}
            aria-current={statusFilter === tab.key ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {totalCount === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Send your first promotional email to customers who opted in to marketing messages."
          action={
            canManage ? (
              <Button as="a" href="/campaigns/new" variant="primary">
                New campaign
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.tablePanel}>
          <div className={styles.tableWrap}>
            <table className={styles.directoryTable}>
              <colgroup>
                <col className={styles.colName} />
                <col className={styles.colAudience} />
                <col className={styles.colStatus} />
                <col className={styles.colMetric} />
                <col className={styles.colMetric} />
                <col className={styles.colSent} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Audience</th>
                  <th scope="col">Status</th>
                  <th scope="col">Open</th>
                  <th scope="col">Click</th>
                  <th scope="col">Sent</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className={styles.clickableRow}>
                    <td>
                      <Link href={`/campaigns/${row.id}`} className={styles.campaignName}>
                        {row.name}
                      </Link>
                      <p className={styles.campaignSubject}>{row.subject}</p>
                    </td>
                    <td>
                      {CAMPAIGN_AUDIENCE_PRESET_LABEL[row.audience_preset as CampaignAudiencePreset]}
                    </td>
                    <td>
                      <StatusPill tone={campaignStatusTone(row.status as CampaignStatus)}>
                        {CAMPAIGN_STATUS_LABEL[row.status as CampaignStatus]}
                      </StatusPill>
                    </td>
                    <td>{formatCampaignRate(row.opened_count, row.delivered_count || row.sent_count)}</td>
                    <td>{formatCampaignRate(row.clicked_count, row.delivered_count || row.sent_count)}</td>
                    <td>
                      {row.sent_at
                        ? new Date(row.sent_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className={styles.directoryFooter}>
            <p className={styles.resultsSummary}>
              Showing {start + 1} to {start + pageRows.length} of {totalCount} campaigns
            </p>
            <nav className={styles.pagination} aria-label="Campaigns pagination">
              {safePage > 1 ? (
                <Link
                  href={`/campaigns${buildCampaignSearchParams({ status: statusFilter, page: safePage - 1 })}`}
                  className={styles.pageNav}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </Link>
              ) : (
                <span className={styles.pageNav} aria-disabled="true">
                  <ChevronLeft size={16} />
                </span>
              )}
              <span className={styles.pageNum} data-active>
                {safePage}
              </span>
              {safePage < totalPages ? (
                <Link
                  href={`/campaigns${buildCampaignSearchParams({ status: statusFilter, page: safePage + 1 })}`}
                  className={styles.pageNav}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </Link>
              ) : (
                <span className={styles.pageNav} aria-disabled="true">
                  <ChevronRight size={16} />
                </span>
              )}
            </nav>
          </footer>
        </div>
      )}
    </>
  );
}
