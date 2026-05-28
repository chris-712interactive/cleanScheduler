import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatUsdFromCents } from '@/lib/format/money';
import {
  cancelCustomerOwnSubscriptionAction,
  openCustomerBillingPortalAction,
} from '@/app/customer/subscriptions/billingPortalActions';
import styles from '../invoices/invoices.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function intervalLabel(i: string): string {
  if (i === 'week') return 'Weekly';
  if (i === 'year') return 'Yearly';
  return 'Monthly';
}

type SubRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  service_plans: { name: string; amount_cents: number; billing_interval: string } | null;
  tenants: { name: string } | null;
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomerSubscriptionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const errMsg = firstParam(sp.error);
  const cancelScheduled = firstParam(sp.subscription_cancel) === 'scheduled';

  const auth = await requirePortalAccess('customer', '/subscriptions');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const supabase = await createClient();
  const { data: subs, error } =
    ctx.customerIds.length > 0
      ? await supabase
          .from('customer_subscriptions')
          .select(
            `
            id,
            tenant_id,
            customer_id,
            status,
            current_period_end,
            cancel_at_period_end,
            service_plans ( name, amount_cents, billing_interval ),
            tenants:tenants!inner ( name )
          `,
          )
          .in('customer_id', ctx.customerIds)
          .order('created_at', { ascending: false })
      : { data: [] as SubRow[], error: null };

  const list = (subs ?? []) as SubRow[];

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Recurring services billed through your providers’ Stripe accounts."
      />

      {errMsg ? (
        <p className={styles.bannerError} role="alert">
          {errMsg}
        </p>
      ) : null}
      {cancelScheduled ? (
        <p className={styles.bannerOk} role="status">
          Your provider was notified — this subscription will end after the current billing period.
        </p>
      ) : null}

      {error ? (
        <Card title="Could not load subscriptions">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !list.length ? (
        <EmptyState
          title="No subscriptions yet"
          description="When a provider enrolls you in a recurring plan and you complete Stripe Checkout, it will show up here."
        />
      ) : (
        <Stack gap={3}>
          {list.map((row) => {
            const spRow = row.service_plans;
            const t = row.tenants as { name: string } | null;
            const label = spRow
              ? `${spRow.name} · ${formatUsdFromCents(spRow.amount_cents)} / ${intervalLabel(spRow.billing_interval)}`
              : 'Subscription';
            const end = row.current_period_end
              ? new Date(String(row.current_period_end)).toLocaleDateString()
              : '—';
            const canCancel =
              row.status !== 'canceled' &&
              !row.cancel_at_period_end &&
              row.status !== 'incomplete_expired';
            return (
              <Card key={row.id} title={label} description={t?.name ?? 'Provider'}>
                <div className={styles.row}>
                  <StatusPill
                    tone={
                      row.status === 'active' || row.status === 'trialing' ? 'brand' : 'neutral'
                    }
                  >
                    {row.status}
                  </StatusPill>
                  {row.cancel_at_period_end ? (
                    <span className={styles.muted}>Cancels at period end</span>
                  ) : null}
                </div>
                <p className={styles.meta}>Current period ends {end}</p>
                <div className={styles.row} style={{ marginTop: 'var(--space-3)' }}>
                  <form action={openCustomerBillingPortalAction}>
                    <input type="hidden" name="tenant_id" value={row.tenant_id} />
                    <input type="hidden" name="customer_id" value={row.customer_id} />
                    <Button type="submit" variant="secondary">
                      Billing portal
                    </Button>
                  </form>
                  {canCancel ? (
                    <form action={cancelCustomerOwnSubscriptionAction}>
                      <input type="hidden" name="tenant_id" value={row.tenant_id} />
                      <input type="hidden" name="customer_id" value={row.customer_id} />
                      <input type="hidden" name="subscription_row_id" value={row.id} />
                      <Button type="submit" variant="secondary">
                        Cancel at period end
                      </Button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </Stack>
      )}
    </>
  );
}
