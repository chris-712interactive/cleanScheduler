import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { loadTenantReferralAudit } from '@/lib/referrals/loadTenantReferralAudit';
import styles from './referrals.module.scss';

export const dynamic = 'force-dynamic';

function attributionTone(
  status: 'pending' | 'qualified' | 'voided',
): 'neutral' | 'success' | 'warning' {
  if (status === 'qualified') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function TenantReferralsAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = sp.status?.trim().toLowerCase();

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/referrals');
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const referralsEnabled = isFeatureEnabled(tier, 'customerReferralProgram');

  const snapshot = referralsEnabled
    ? await loadTenantReferralAudit(admin, membership.tenantId)
    : { attributions: [], rewardEvents: [] };

  const filteredAttributions = snapshot.attributions.filter((row) => {
    if (!statusFilter || statusFilter === 'all') return true;
    return row.status === statusFilter;
  });

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'voided', label: 'Voided' },
  ];

  return (
    <>
      <PageHeader
        title="Referral activity"
        titleHint="Attributions and wallet rewards issued when referred customers qualify."
        actions={
          referralsEnabled ? (
            <Link href="/referrals/export" className={styles.exportLink}>
              Export CSV
            </Link>
          ) : undefined
        }
      />

      <Stack gap={6}>
        {!referralsEnabled ? (
          <FeatureUpgradePanel
            title="Referrals require Business or higher"
            description={`Upgrade to ${minimumTierLabelForFeature('customerReferralProgram')} to run a customer referral program.`}
          />
        ) : (
          <>
            <p className={styles.lead}>
              Configure rewards in{' '}
              <Link href="/settings/referrals" className={styles.inlineLink}>
                Referral program settings
              </Link>
              . Customers qualify when they pay their first invoice.
            </p>

            <Card title="Attributions">
              <nav className={styles.tabs} aria-label="Attribution status">
                {tabs.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.key === 'all' ? '/referrals' : `/referrals?status=${tab.key}`}
                    className={
                      (statusFilter ?? 'all') === tab.key || (!statusFilter && tab.key === 'all')
                        ? styles.tabActive
                        : styles.tab
                    }
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>

              {filteredAttributions.length === 0 ? (
                <p className={styles.muted}>No referral attributions yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Status</th>
                        <th scope="col">Referrer</th>
                        <th scope="col">Referee</th>
                        <th scope="col">Source</th>
                        <th scope="col">Attributed</th>
                        <th scope="col">Qualified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttributions.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <StatusPill tone={attributionTone(row.status)}>{row.status}</StatusPill>
                          </td>
                          <td>
                            <Link
                              href={`/customers/${row.referrerCustomerId}`}
                              className={styles.rowLink}
                            >
                              {row.referrerName}
                            </Link>
                            {row.referralCode ? (
                              <span className={styles.subtle}> · {row.referralCode}</span>
                            ) : null}
                          </td>
                          <td>
                            <Link
                              href={`/customers/${row.refereeCustomerId}`}
                              className={styles.rowLink}
                            >
                              {row.refereeName}
                            </Link>
                          </td>
                          <td>{row.attributionSource === 'manual' ? 'Staff' : 'Link'}</td>
                          <td>{new Date(row.attributedAt).toLocaleDateString()}</td>
                          <td>
                            {row.qualifiedAt ? new Date(row.qualifiedAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Reward events">
              {snapshot.rewardEvents.length === 0 ? (
                <p className={styles.muted}>No referral rewards issued yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Recipient</th>
                        <th scope="col">Customer</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.rewardEvents.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.recipient === 'referrer' ? 'Referrer' : 'Referee'}</td>
                          <td>
                            <Link href={`/customers/${row.customerId}`} className={styles.rowLink}>
                              {row.customerName}
                            </Link>
                          </td>
                          <td>{row.amountLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </Stack>
    </>
  );
}
