import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createClient } from '@/lib/supabase/server';
import { formatUsdFromCents } from '@/lib/format/money';
import { createCustomerInvoicePayCheckoutSessionAction } from '@/app/customer/invoices/invoicePayCheckoutActions';
import styles from '../invoices.module.scss';

export const dynamic = 'force-dynamic';

type InvoiceDetailRow = {
  id: string;
  title: string;
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  tenant_id: string;
  customer_id: string;
  tenants: { name: string; stripe_connect_status: string } | null;
};

type PaymentRow = {
  id: string;
  amount_cents: number;
  method: string;
  notes: string | null;
  recorded_at: string;
  recorded_via: string | null;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomerInvoiceDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const auth = await requirePortalAccess('customer', `/invoices/${id}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.length) redirect('/access-denied?reason=no_customer_profile');

  const supabase = await createClient();
  const { data: inv, error } = await supabase
    .from('tenant_invoices')
    .select(
      `
      id,
      title,
      status,
      amount_cents,
      amount_paid_cents,
      due_date,
      notes,
      created_at,
      tenant_id,
      customer_id,
      tenants:tenants!inner ( name, stripe_connect_status )
    `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !inv) notFound();
  const row = inv as InvoiceDetailRow;
  if (!ctx.customerIds.includes(row.customer_id)) notFound();

  const tenants = row.tenants;
  const connectComplete = tenants?.stripe_connect_status === 'complete';
  const remaining = row.amount_cents - row.amount_paid_cents;
  const canPayOnline = connectComplete && remaining > 0 && row.status !== 'void';

  const checkoutErr = firstParam(sp.error);
  const checkoutOk = firstParam(sp.checkout) === 'success';
  const checkoutCanceled = firstParam(sp.checkout) === 'canceled';

  const { data: payments } = await supabase
    .from('tenant_invoice_payments')
    .select('id, amount_cents, method, notes, recorded_at, recorded_via')
    .eq('invoice_id', id)
    .order('recorded_at', { ascending: false });

  return (
    <>
      <PageHeader
        title={row.title}
        description={`${tenants?.name ?? 'Provider'} · ${row.status}`}
      />

      <p className={styles.meta}>
        <Link href="/invoices">← All invoices</Link>
      </p>

      {checkoutErr ? (
        <p className={styles.bannerError} role="alert">
          {checkoutErr}
        </p>
      ) : null}
      {checkoutOk ? (
        <p className={styles.bannerOk} role="status">
          Payment received. If your balance has not updated yet, refresh in a few seconds.
        </p>
      ) : null}
      {checkoutCanceled ? (
        <p className={styles.muted} role="status">
          Checkout canceled — no charge was made.
        </p>
      ) : null}

      <Card title="Balance">
        <p className={styles.meta}>
          Total {formatUsdFromCents(row.amount_cents)} · Paid {formatUsdFromCents(row.amount_paid_cents)} · Balance{' '}
          <strong>{formatUsdFromCents(Math.max(0, remaining))}</strong>
        </p>
        {row.due_date ? (
          <p className={styles.meta}>Due {new Date(String(row.due_date)).toLocaleDateString()}</p>
        ) : null}
        {canPayOnline ? (
          <form action={createCustomerInvoicePayCheckoutSessionAction} style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="invoice_id" value={row.id} />
            <Button type="submit" variant="primary">
              Pay balance with card
            </Button>
          </form>
        ) : remaining > 0 ? (
          <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
            Online card payment becomes available when this provider finishes Stripe Connect setup. You can pay them
            using the methods they accept outside the app.
          </p>
        ) : null}
      </Card>

      {row.notes?.trim() ? (
        <Card title="Notes">
          <p className={styles.meta}>{row.notes.trim()}</p>
        </Card>
      ) : null}

      <Card title="Payments">
        {!payments?.length ? (
          <p className={styles.muted}>No payments recorded yet.</p>
        ) : (
          <ul className={styles.meta} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(payments as PaymentRow[]).map((p) => (
              <li
                key={p.id}
                style={{
                  padding: 'var(--space-2) 0',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                {formatUsdFromCents(p.amount_cents)} · {p.method}
                {p.recorded_via === 'stripe_checkout' ? ' (Stripe)' : ''}
                {p.notes ? ` · ${p.notes}` : ''}
                <span className={styles.muted}> · {new Date(String(p.recorded_at)).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
