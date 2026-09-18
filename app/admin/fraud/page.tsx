import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { createAdminClient } from '@/lib/supabase/server';
import { loadAdminFraudAlerts, type FraudAlertKind } from '@/lib/admin/loadAdminFraudAlerts';
import { requirePlatformAdmin } from '@/lib/auth/portalAccess';
import styles from '../tenants/tenants.module.scss';

export const dynamic = 'force-dynamic';

function toneForKind(kind: FraudAlertKind): 'danger' | 'warning' | 'neutral' {
  switch (kind) {
    case 'dispute':
    case 'velocity_blocked':
      return 'danger';
    case 'access_suspended':
    case 'connect_frozen':
      return 'warning';
    default:
      return 'neutral';
  }
}

function labelForKind(kind: FraudAlertKind): string {
  switch (kind) {
    case 'dispute':
      return 'Dispute';
    case 'velocity_blocked':
      return 'Velocity';
    case 'access_suspended':
      return 'Suspended';
    case 'connect_frozen':
      return 'Frozen';
    default:
      return kind;
  }
}

export default async function AdminFraudAlertsPage() {
  await requirePlatformAdmin('/fraud');
  const admin = createAdminClient();
  const alerts = await loadAdminFraudAlerts(admin, { limit: 100 });

  return (
    <>
      <PageHeader
        title="Fraud alerts"
        description="Connect velocity blocks, disputes, and recent admin risk actions (last 30 days)."
      />

      <Container size="lg">
        <p className={styles.backWrap}>
          <Link href="/fraud/signup-blocks" className={styles.backLink}>
            Manage signup email blocks →
          </Link>
        </p>
        {alerts.length === 0 ? (
          <EmptyState
            title="No recent alerts"
            description="Velocity blocks, Connect disputes, and admin freeze/suspend actions will appear here."
          />
        ) : (
          <Stack gap={2}>
            {alerts.map((alert) => (
              <Card
                key={alert.id}
                title={alert.title}
                description={new Date(alert.createdAt).toLocaleString()}
              >
                <div className={styles.meta}>
                  <StatusPill tone={toneForKind(alert.kind)}>{labelForKind(alert.kind)}</StatusPill>
                  <span className={styles.alertKind}>
                    {alert.tenantSlug ?? alert.tenantId ?? 'Unknown tenant'}
                  </span>
                </div>
                {alert.tenantName ? <p className={styles.name}>{alert.tenantName}</p> : null}
                <p className={styles.empty}>{alert.detail}</p>
                {alert.href ? (
                  <p className={styles.backWrap}>
                    <Link href={alert.href} className={styles.backLink}>
                      Open tenant →
                    </Link>
                  </p>
                ) : null}
              </Card>
            ))}
          </Stack>
        )}
      </Container>
    </>
  );
}
