import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { Stack } from '@/components/layout/Stack';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatPlatformMrrLabel, getPlatformAccountingSummary } from '@/lib/admin/platformStats';
import { platformAccountingSummaryToCsv } from '@/lib/admin/platformAccountingCsv';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from '../tenants/tenants.module.scss';
import metricStyles from '../admin-dashboard.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminAccountingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const summary = await getPlatformAccountingSummary();

  if (firstParam(sp.export) === 'csv') {
    const csv = platformAccountingSummaryToCsv(summary);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="platform-accounting.csv"',
      },
    }) as unknown as React.ReactElement;
  }

  return (
    <>
      <PageHeader
        title="Accounting"
        description="Platform subscription revenue, estimated MRR, and per-tenant billing status."
        actions={
          <Link href="/accounting?export=csv" className={styles.slugLink}>
            Export CSV
          </Link>
        }
      />

      <Container size="lg">
        <Stack gap={6}>
          <Grid min="240px" gap={4}>
            <Card title="MRR" description="Estimated from active platform subscriptions">
              <div className={metricStyles.metric}>
                <span className={metricStyles.metricValue}>
                  {formatPlatformMrrLabel(summary.estimatedMrrCents)}
                </span>
                <StatusPill tone={summary.estimatedMrrCents > 0 ? 'success' : 'neutral'}>
                  {summary.activePaidSubscriptions > 0
                    ? `${summary.activePaidSubscriptions} paying`
                    : 'No paid subscriptions yet'}
                </StatusPill>
              </div>
            </Card>
            <Card
              title="Revenue YTD (estimated)"
              description="Active subscriptions × months live since Jan 1 or activation"
            >
              <div className={metricStyles.metric}>
                <span className={metricStyles.metricValue}>
                  {formatUsdFromCents(summary.estimatedRevenueYtdCents)}
                </span>
                <StatusPill tone="neutral">Estimated — not Stripe ledger</StatusPill>
              </div>
            </Card>
          </Grid>

          <Card
            title="Tenant subscriptions"
            description="Workspace platform plans and estimated recurring revenue"
          >
            {summary.tenantSubscriptions.length === 0 ? (
              <p className={styles.empty}>No tenants yet.</p>
            ) : (
              <Stack gap={3}>
                <ul className={styles.list}>
                  {summary.tenantSubscriptions.map((row) => (
                    <li key={row.tenantSlug} className={styles.row}>
                      <div className={styles.rowMain}>
                        <Link href={`/tenants/${row.tenantSlug}`} className={styles.slugLink}>
                          {row.tenantSlug}
                        </Link>
                        <span className={styles.name}>{row.tenantName}</span>
                      </div>
                      <div className={styles.meta}>
                        <StatusPill tone={row.isActive ? 'brand' : 'neutral'}>
                          {row.isActive ? 'active' : 'inactive'}
                        </StatusPill>
                        {row.platformPlanLabel ? (
                          <span className={styles.badge}>{row.platformPlanLabel}</span>
                        ) : null}
                        <span className={styles.badge}>{row.status}</span>
                        {row.monthlyRecurringCents > 0 ? (
                          <span className={styles.badge}>
                            {formatUsdFromCents(row.monthlyRecurringCents)}/mo est.
                          </span>
                        ) : (
                          <span className={styles.hintMuted}>no recurring revenue</span>
                        )}
                        {row.stripeSubscriptionId ? (
                          <span className={styles.hint}>Stripe linked</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </Stack>
            )}
          </Card>

          <Card title="Summary" description="Key figures for founder reporting">
            <KeyValueList
              items={[
                { key: 'Estimated MRR', value: formatPlatformMrrLabel(summary.estimatedMrrCents) },
                {
                  key: 'Revenue YTD (estimated)',
                  value: formatUsdFromCents(summary.estimatedRevenueYtdCents),
                },
                {
                  key: 'Paying subscriptions',
                  value: String(summary.activePaidSubscriptions),
                },
                { key: 'Tenants tracked', value: String(summary.tenantSubscriptions.length) },
              ]}
            />
          </Card>
        </Stack>
      </Container>
    </>
  );
}
