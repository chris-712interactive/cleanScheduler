import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { openCustomerPaymentMethodsPortalAction } from './actions';
import styles from '../invoices/invoices.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerPaymentMethodsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const err = firstParam(sp.error);
  const auth = await requirePortalAccess('customer', '/payment-methods');
  const ctx = await getCustomerPortalContext(auth.user.id);
  const admin = createAdminClient();

  const portalLinks = await Promise.all(
    (ctx?.links ?? []).map(async (link) => {
      const [gate, stripeLink] = await Promise.all([
        requireConnectForOnlinePayments(admin, link.tenantId),
        admin
          .from('tenant_customer_stripe_customers')
          .select('stripe_customer_id')
          .eq('tenant_id', link.tenantId)
          .eq('customer_id', link.customerId)
          .maybeSingle(),
      ]);
      return {
        ...link,
        portalReady: gate.ok && Boolean(stripeLink.data?.stripe_customer_id),
        gateMessage: gate.ok ? null : gate.message,
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Payment methods"
        description="Manage cards on file with each provider through Stripe's secure billing portal."
      />

      {err ? (
        <p className={styles.bannerError} role="alert">
          {err}
        </p>
      ) : null}

      {!portalLinks.length ? (
        <Card title="No providers linked">
          <p className={styles.muted}>
            When a cleaning company adds you as a customer, you can manage saved cards here after
            your first online payment or subscription.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {portalLinks.map((link) => (
            <Card key={link.linkId} title={link.tenantName}>
              {link.portalReady ? (
                <form action={openCustomerPaymentMethodsPortalAction}>
                  <input type="hidden" name="tenant_id" value={link.tenantId} />
                  <input type="hidden" name="customer_id" value={link.customerId} />
                  <Button type="submit" variant="primary">
                    Manage payment methods
                  </Button>
                </form>
              ) : (
                <p className={styles.muted}>
                  {link.gateMessage ??
                    'Pay an invoice or subscribe online with this provider first to unlock saved payment methods.'}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className={styles.meta} style={{ marginTop: 'var(--space-4)' }}>
        <Link href="/invoices">View invoices</Link>
      </p>
    </>
  );
}
