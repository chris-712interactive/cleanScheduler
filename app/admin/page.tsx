import { ArrowUpRight, Building2, CreditCard, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import styles from './admin-dashboard.module.scss';

export default function AdminDashboardPage() {
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
          <Card title="Active tenants" description="Across all environments">
            <div className={styles.metric}>
              <span className={styles.metricValue}>0</span>
              <StatusPill tone="brand" icon={<Building2 size={14} />}>
                Awaiting first signup
              </StatusPill>
            </div>
          </Card>
          <Card title="MRR" description="Subscription revenue">
            <div className={styles.metric}>
              <span className={styles.metricValue}>$0</span>
              <StatusPill tone="neutral">No data yet</StatusPill>
            </div>
          </Card>
          <Card title="Customer accounts" description="Across all tenants">
            <div className={styles.metric}>
              <span className={styles.metricValue}>0</span>
              <StatusPill tone="neutral" icon={<Users size={14} />}>
                Idle
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
          title="Welcome - this is the scaffold"
          description="The shell, theme system, and navigation are wired up. Real data will arrive as
                        tenants, billing, and activity feeds come online."
        >
          <p>
            This portal is served from <code>admin.&lt;apex&gt;</code> and rewritten
            internally to <code>/admin</code> by the subdomain middleware.
          </p>
        </Card>
      </Stack>
    </>
  );
}
