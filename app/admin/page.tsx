import { ArrowUpRight, Building2, CreditCard, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPlatformDashboardStats } from '@/lib/admin/platformStats';
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
              <StatusPill tone={stats.activeTenants > 0 ? 'brand' : 'neutral'} icon={<Building2 size={14} />}>
                {stats.activeTenants > 0 ? 'Tenants live' : 'Awaiting first signup'}
              </StatusPill>
            </div>
          </Card>
          <Card title="MRR" description="Subscription revenue">
            <div className={styles.metric}>
              <span className={styles.metricValue}>$0</span>
              <StatusPill tone="neutral">No data yet</StatusPill>
            </div>
          </Card>
          <Card title="Customer accounts" description="Customer records across all tenants">
            <div className={styles.metric}>
              <span className={styles.metricValue}>{stats.customerRecords}</span>
              <StatusPill tone={stats.customerRecords > 0 ? 'brand' : 'neutral'} icon={<Users size={14} />}>
                {stats.customerRecords > 0 ? 'Tracking' : 'None yet'}
              </StatusPill>
            </div>
          </Card>
          <Card title="Stripe Connect health" description="Connected tenants on track">
            <div className={styles.metric}>
              <span className={styles.metricValue}>--</span>
              <StatusPill tone="warning" icon={<CreditCard size={14} />}>
                Not configured
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
