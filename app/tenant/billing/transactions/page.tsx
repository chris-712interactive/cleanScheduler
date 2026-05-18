import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

function paymentMethodLabel(method: string, recordedVia: string): string {
  if (recordedVia === 'stripe_checkout') return 'Card (Stripe)';
  const labels: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    zelle: 'Zelle',
    card: 'Card',
    ach: 'ACH',
    other: 'Other',
  };
  return labels[method] ?? method;
}

export default async function TenantBillingTransactionsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/transactions');
  const db = createTenantPortalDbClient();

  const { data: payments, error } = await db
    .from('tenant_invoice_payments')
    .select(
      `
      id,
      amount_cents,
      method,
      recorded_at,
      recorded_via,
      notes,
      tenant_invoices (
        id,
        title
      )
    `,
    )
    .eq('tenant_id', membership.tenantId)
    .order('recorded_at', { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Payments recorded against customer invoices — manual entries and Stripe Checkout."
      />

      <p className={styles.backLinkWrap}>
        <Link href="/billing" className={styles.backLink}>
          ← Workspace billing
        </Link>
      </p>

      {error ? (
        <Card title="Could not load transactions">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !payments?.length ? (
        <EmptyState
          title="No transactions yet"
          description="Payments appear here when you record them on an invoice or when a customer pays online."
          action={
            <Link href="/billing/invoices" className={styles.backLink}>
              View invoices
            </Link>
          }
        />
      ) : (
        <Stack gap={2}>
          {payments.map((p) => {
            const inv = p.tenant_invoices as { id: string; title: string } | null;
            return (
              <Card
                key={p.id}
                title={inv?.title ?? 'Invoice payment'}
                description={new Date(p.recorded_at).toLocaleString()}
              >
                <div className={styles.invoiceRow}>
                  <div>
                    <strong>{formatUsdFromCents(p.amount_cents)}</strong>
                    <span className={styles.muted}>
                      {' '}
                      · {paymentMethodLabel(p.method, p.recorded_via)}
                    </span>
                    {p.notes?.trim() ? (
                      <span className={styles.muted}> · {p.notes.trim()}</span>
                    ) : null}
                  </div>
                  {inv ? (
                    <Link href={`/billing/invoices/${inv.id}`} className={styles.backLink}>
                      View invoice →
                    </Link>
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
