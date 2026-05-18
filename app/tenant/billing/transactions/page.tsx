import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

function paymentMethodLabel(method: string, recordedVia: string): string {
  if (recordedVia === 'stripe_checkout') return 'Stripe';
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

type PaymentRow = {
  id: string;
  amount_cents: number;
  method: string;
  recorded_at: string;
  recorded_via: string;
  notes: string | null;
  tenant_invoices: {
    id: string;
    title: string;
    customers: {
      customer_identities: {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
      } | null;
    } | null;
  } | null;
};

function customerLabel(row: PaymentRow): string {
  const ident = row.tenant_invoices?.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return '—';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? '—' : name;
}

function formatPostedDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
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
        title,
        customers (
          customer_identities (
            first_name,
            last_name,
            full_name
          )
        )
      )
    `,
    )
    .eq('tenant_id', membership.tenantId)
    .order('recorded_at', { ascending: false })
    .limit(200);

  const rows = (payments ?? []) as PaymentRow[];

  return (
    <>
      <PageHeader
        title="Transactions"
        description="All payments recorded on customer invoices — manual entries and Stripe Checkout."
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
      ) : !rows.length ? (
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
        <Card
          title="Payment ledger"
          description={`${rows.length} most recent · click an invoice to open details`}
          padded={false}
        >
          <div className={styles.tableWrap}>
            <table className={styles.ledgerTable}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Invoice</th>
                  <th scope="col">Method</th>
                  <th scope="col" className={styles.amountCol}>
                    Amount
                  </th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const inv = p.tenant_invoices;
                  const posted = formatPostedDate(p.recorded_at);
                  const note = p.notes?.trim() ?? '';

                  return (
                    <tr key={p.id}>
                      <td className={styles.dateCell}>
                        <span className={styles.datePrimary}>{posted.date}</span>
                        <span className={styles.dateSecondary}>{posted.time}</span>
                      </td>
                      <td className={styles.customerCell}>{customerLabel(p)}</td>
                      <td>
                        {inv ? (
                          <Link href={`/billing/invoices/${inv.id}`} className={styles.rowLink}>
                            {inv.title || 'Invoice'}
                          </Link>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td className={styles.methodCell}>
                        {paymentMethodLabel(p.method, p.recorded_via)}
                      </td>
                      <td className={styles.amountCol}>
                        {formatUsdFromCents(p.amount_cents)}
                      </td>
                      <td className={styles.noteCell} title={note || undefined}>
                        {note || <span className={styles.muted}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
