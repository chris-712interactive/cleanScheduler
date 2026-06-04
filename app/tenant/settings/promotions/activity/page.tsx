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
import { loadTenantPromotionActivity } from '@/lib/promotions/loadTenantPromotionActivity';
import { walletTransactionKindLabel } from '@/lib/promotions/walletTransactionDisplay';
import styles from '../promotions-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantPromotionActivityPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/promotions/activity');
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const promotionsEnabled = isFeatureEnabled(tier, 'customerPromotions');

  const snapshot = promotionsEnabled
    ? await loadTenantPromotionActivity(admin, membership.tenantId)
    : { redemptions: [], walletTransactions: [] };

  return (
    <>
      <PageHeader
        title="Promotion activity"
        titleHint="Recent promo redemptions and wallet ledger entries across customers."
        backHref="/settings/promotions"
        backLabel="Promotions"
      />

      <Stack gap={6}>
        {!promotionsEnabled ? (
          <FeatureUpgradePanel
            title="Promotions require Business or higher"
            description={`Upgrade to ${minimumTierLabelForFeature('customerPromotions')} to create discount codes and customer wallet credits.`}
          />
        ) : (
          <>
            <p className={styles.hint}>
              Manage templates in{' '}
              <Link href="/settings/promotions" className={styles.inlineLink}>
                Promotions settings
              </Link>
              . Referral rewards also appear in{' '}
              <Link href="/referrals" className={styles.inlineLink}>
                Referral activity
              </Link>
              .
            </p>

            <Card title="Promo redemptions">
              {snapshot.redemptions.length === 0 ? (
                <p className={styles.hint}>No redemptions recorded yet.</p>
              ) : (
                <div className={styles.activityTableWrap}>
                  <table className={styles.activityTable}>
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Customer</th>
                        <th scope="col">Code</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Status</th>
                        <th scope="col">Applied to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.redemptions.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.redeemedAt).toLocaleString()}</td>
                          <td>
                            <Link href={`/customers/${row.customerId}`}>{row.customerName}</Link>
                          </td>
                          <td>{row.promotionCode ?? '—'}</td>
                          <td>{row.amountLabel}</td>
                          <td>
                            <StatusPill tone={row.status === 'completed' ? 'success' : 'neutral'}>
                              {row.status}
                            </StatusPill>
                          </td>
                          <td>
                            {row.quoteId ? (
                              <Link href={`/quotes/${row.quoteId}`}>Quote</Link>
                            ) : row.invoiceId ? (
                              <span>Invoice</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Wallet ledger">
              {snapshot.walletTransactions.length === 0 ? (
                <p className={styles.hint}>No wallet transactions yet.</p>
              ) : (
                <div className={styles.activityTableWrap}>
                  <table className={styles.activityTable}>
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Customer</th>
                        <th scope="col">Type</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Balance after</th>
                        <th scope="col">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.walletTransactions.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>
                            <Link href={`/customers/${row.customerId}`}>{row.customerName}</Link>
                          </td>
                          <td>{walletTransactionKindLabel(row.kind)}</td>
                          <td>{row.amountLabel}</td>
                          <td>{row.balanceAfterLabel}</td>
                          <td>{row.note ?? '—'}</td>
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
