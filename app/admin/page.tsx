import Link from 'next/link';
import { ArrowUpRight, Building2, Calendar, CreditCard, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { loadSeoTaskChecklist } from '@/lib/admin/seoTasks';
import { getPlatformDashboardStats, formatPlatformMrrLabel } from '@/lib/admin/platformStats';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { isPlatformSalesRole } from '@/lib/auth/platformRoles';
import { completeSalesTaskAction } from '@/lib/admin/salesActions';
import { countLeadsByStage, listOpenSalesTasks, listUpcomingDemos } from '@/lib/admin/salesQueries';
import { salesTaskKindLabel } from '@/lib/admin/salesTypes';
import { createAdminClient } from '@/lib/supabase/server';
import styles from './admin-dashboard.module.scss';
import pipelineStyles from './pipeline/pipeline.module.scss';

export default async function AdminDashboardPage() {
  const auth = await requirePortalAccess('admin', '/');
  const admin = createAdminClient();

  if (isPlatformSalesRole(auth.claims.appRole)) {
    const [tasks, demos, counts] = await Promise.all([
      listOpenSalesTasks(admin, { assignedTo: auth.user.id }),
      listUpcomingDemos(admin),
      countLeadsByStage(admin),
    ]);
    const openCount =
      counts.new +
      counts.contacted +
      counts.demo_scheduled +
      counts.demo_completed +
      counts.trial +
      counts.negotiating;

    return (
      <>
        <PageHeader
          title="Sales dashboard"
          description="Your tasks, demos, and pipeline. Trials get a follow-up task when they are within 3 days of expiring."
          actions={
            <Button as={Link} href="/pipeline" variant="primary">
              Open pipeline
            </Button>
          }
        />
        <Stack gap={6}>
          <Grid min="200px" gap={4}>
            <Card title="Open pipeline">
              <div className={styles.metric}>
                <span className={styles.metricValue}>{openCount}</span>
                <StatusPill tone="brand">{counts.trial} on trial</StatusPill>
              </div>
            </Card>
            <Card title="Your tasks">
              <div className={styles.metric}>
                <span className={styles.metricValue}>{tasks.length}</span>
                <StatusPill tone={tasks.length > 0 ? 'warning' : 'success'}>
                  {tasks.length > 0 ? 'Action needed' : 'Caught up'}
                </StatusPill>
              </div>
            </Card>
            <Card title="Upcoming demos">
              <div className={styles.metric}>
                <span className={styles.metricValue}>{demos.length}</span>
                <StatusPill tone="neutral" icon={<Calendar size={14} />}>
                  Scheduled
                </StatusPill>
              </div>
            </Card>
          </Grid>

          <Card title="Tasks assigned to you">
            {tasks.length === 0 ? (
              <p>No open tasks. Add a lead or wait for a trial-expiry follow-up.</p>
            ) : (
              <ul className={pipelineStyles.cardList}>
                {tasks.map((task) => (
                  <li key={task.id} className={pipelineStyles.taskRow}>
                    <div className={pipelineStyles.taskMain}>
                      <Link href={`/pipeline/${task.lead_id}`} className={pipelineStyles.taskTitle}>
                        {task.title}
                      </Link>
                      <p className={pipelineStyles.muted}>
                        {task.business_name} · {salesTaskKindLabel(task.kind)} ·{' '}
                        {new Date(task.due_at).toLocaleString()}
                      </p>
                    </div>
                    <form action={completeSalesTaskAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="leadId" value={task.lead_id} />
                      <input type="hidden" name="returnTo" value="/" />
                      <Button type="submit" variant="secondary" size="sm">
                        Done
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Stack>
      </>
    );
  }

  const [stats, seoChecklist] = await Promise.all([
    getPlatformDashboardStats(),
    loadSeoTaskChecklist(admin).catch(() => null),
  ]);

  return (
    <>
      <PageHeader
        title="Founder dashboard"
        description="Cross-tenant view of platform health, revenue, and activity."
        actions={
          <Button as={Link} href="/seo" variant="secondary" iconRight={<ArrowUpRight size={16} />}>
            Open SEO checklist
          </Button>
        }
      />

      <Stack gap={6}>
        <Grid min="240px" gap={4}>
          <Card
            title="Active tenants"
            description={
              stats.newTenantsLast7Days > 0
                ? `${stats.newTenantsLast7Days} new in the last 7 days · ${stats.tenantsOnTrial} on trial`
                : `${stats.tenantsOnTrial} on trial · signups from marketing onboarding`
            }
          >
            <div className={styles.metric}>
              <span className={styles.metricValue}>{stats.activeTenants}</span>
              <StatusPill
                tone={stats.activeTenants > 0 ? 'brand' : 'neutral'}
                icon={<Building2 size={14} />}
              >
                {stats.activeTenants > 0 ? 'Tenants live' : 'Awaiting first signup'}
              </StatusPill>
            </div>
          </Card>
          <Card title="MRR" description="Estimated from active platform subscriptions">
            <div className={styles.metric}>
              <span className={styles.metricValue}>
                {formatPlatformMrrLabel(stats.estimatedMrrCents)}
              </span>
              <StatusPill tone={stats.estimatedMrrCents > 0 ? 'success' : 'neutral'}>
                {stats.activePaidSubscriptions > 0
                  ? `${stats.activePaidSubscriptions} paying`
                  : 'No paid subscriptions yet'}
              </StatusPill>
            </div>
          </Card>
          <Card title="Customer accounts" description="Customer records across all tenants">
            <div className={styles.metric}>
              <span className={styles.metricValue}>{stats.customerRecords}</span>
              <StatusPill
                tone={stats.customerRecords > 0 ? 'brand' : 'neutral'}
                icon={<Users size={14} />}
              >
                {stats.customerRecords > 0 ? 'Tracking' : 'None yet'}
              </StatusPill>
            </div>
          </Card>
          <Card title="Stripe Connect health" description="Active tenants with live card payments">
            <div className={styles.metric}>
              <span className={styles.metricValue}>
                {stats.connectTrackedTenants > 0
                  ? `${stats.connectCompleteTenants}/${stats.connectTrackedTenants}`
                  : '—'}
              </span>
              <StatusPill
                tone={
                  stats.connectTrackedTenants > 0 &&
                  stats.connectCompleteTenants === stats.connectTrackedTenants
                    ? 'success'
                    : stats.connectCompleteTenants > 0
                      ? 'warning'
                      : 'neutral'
                }
                icon={<CreditCard size={14} />}
              >
                {stats.connectCompleteTenants > 0 ? 'Connect live' : 'None complete yet'}
              </StatusPill>
            </div>
          </Card>
        </Grid>

        {seoChecklist ? (
          <Card
            title="SEO tasks"
            description={
              seoChecklist.dueCount > 0
                ? `${seoChecklist.dueCount} due now${seoChecklist.dueAgainCount > 0 ? ` · ${seoChecklist.dueAgainCount} recurring due again` : ''}`
                : 'All SEO checklist items are complete for now'
            }
          >
            <div className={styles.metric}>
              <span className={styles.metricValue}>
                {seoChecklist.completedCount} / {seoChecklist.totalCount}
              </span>
              <StatusPill
                tone={seoChecklist.dueCount > 0 ? 'warning' : 'success'}
                icon={<Search size={14} />}
              >
                {seoChecklist.dueCount > 0 ? 'Action needed' : 'On track'}
              </StatusPill>
            </div>
            <p style={{ marginTop: 'var(--space-3)' }}>
              <Link href="/seo">Open SEO checklist →</Link>
            </p>
          </Card>
        ) : null}

        <Card
          title={stats.activeTenants > 0 ? 'Platform snapshot' : 'Getting started'}
          description={
            stats.activeTenants > 0
              ? 'Counts refresh on each load from Supabase.'
              : 'When tenants complete self-serve onboarding, active tenant and trial counts appear above.'
          }
        >
          <p>
            This portal is served from <code>admin.&lt;apex&gt;</code> and rewritten internally to{' '}
            <code>/admin</code> by the subdomain middleware.
          </p>
        </Card>
      </Stack>
    </>
  );
}
