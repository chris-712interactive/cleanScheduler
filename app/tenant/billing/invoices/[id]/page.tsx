import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { recordInvoicePaymentAction } from '@/lib/admin/tenantInvoiceActions';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from '../../billing.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/billing/invoices/${id}`);
  const db = createTenantPortalDbClient();

  const { data: inv, error } = await db
    .from('tenant_invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (error || !inv) {
    notFound();
  }

  const { data: payments } = await db
    .from('tenant_invoice_payments')
    .select('*')
    .eq('invoice_id', id)
    .order('recorded_at', { ascending: false });

  const remaining = inv.amount_cents - inv.amount_paid_cents;

  return (
    <>
      <PageHeader title={inv.title} description={`Invoice · ${inv.status}`} />

      <p className={styles.backLinkWrap}>
        <Link href="/billing/invoices" className={styles.backLink}>
          ← All invoices
        </Link>
      </p>

      <Stack gap={4}>
        <Card title="Summary">
          <KeyValueList
            items={[
              { key: 'Total', value: formatUsdFromCents(inv.amount_cents) },
              { key: 'Paid', value: formatUsdFromCents(inv.amount_paid_cents) },
              { key: 'Balance', value: formatUsdFromCents(Math.max(0, remaining)) },
              {
                key: 'Due',
                value: inv.due_date ? new Date(String(inv.due_date)).toLocaleDateString() : '—',
              },
              { key: 'Notes', value: inv.notes?.trim() || '—' },
            ]}
          />
        </Card>

        {inv.status !== 'void' && remaining > 0 ? (
          <Card title="Record payment" description="Manual cash, check, or Zelle recording (card charges ship with Connect).">
            <form action={recordInvoicePaymentAction} className={styles.resumeForm}>
              <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
              <input type="hidden" name="invoice_id" value={inv.id} />
              <label className={styles.field}>
                <span>Amount (USD)</span>
                <input
                  name="amount_dollars"
                  type="text"
                  className={styles.input}
                  placeholder={(remaining / 100).toFixed(2)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Method</span>
                <select name="method" className={styles.select} defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="zelle">Zelle</option>
                  <option value="ach">ACH</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Notes (optional)</span>
                <input name="notes" type="text" className={styles.input} />
              </label>
              <Button type="submit" variant="primary">
                Apply payment
              </Button>
            </form>
          </Card>
        ) : null}

        <Card title="Payment history" description={payments?.length ? `${payments.length} entries` : 'No payments yet'}>
          {!payments?.length ? (
            <p className={styles.muted}>Payments appear here when recorded.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {payments.map((p) => (
                <li key={p.id} style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>{formatUsdFromCents(p.amount_cents)}</strong> · {p.method} ·{' '}
                  {new Date(p.recorded_at).toLocaleString()}
                  {p.notes ? <span className={styles.muted}> — {p.notes}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Stack>
    </>
  );
}
