import { ArrowUpRight, Building2, CreditCard, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPlatformDashboardStats, formatPlatformMrrLabel } from '@/lib/admin/platformStats';
import styles from './admin-dashboard.module.scss';

export default async function AdminDashboardPage() {
  const stats = await getPlatformDashboardStats();

  return (
    <>
      <PageHeader
        title="Founder dashboard"
        description="Cross-tenant view of platform health, revenue, and activity."
        actions={
          <Button variant="secondary" iconRight={<ArrowUpRight size={16} />}>
            Open status page
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
              <span className={styles.metricValue}>{formatPlatformMrrLabel(stats.estimatedMrrCents)}</span>
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
