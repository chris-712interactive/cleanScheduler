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
import { createInvoicePayCheckoutSessionAction } from '@/app/tenant/billing/invoiceCheckoutActions';
import { sendTenantInvoiceEmailAction } from '@/app/tenant/billing/invoiceEmailActions';
import { refundStripeInvoicePaymentAction } from '@/app/tenant/billing/invoiceRefundActions';
import { formatUsdFromCents } from '@/lib/format/money';
import { isResendConfigured } from '@/lib/email/resend';
import styles from '../../billing.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function paymentMethodLabel(p: {
  method: string;
  recorded_via?: string | null;
}): string {
  if (p.recorded_via === 'stripe_checkout') return 'Card (Stripe Checkout)';
  return p.method;
}

export default async function TenantInvoiceDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/billing/invoices/${id}`);
  const db = createTenantPortalDbClient();

  const checkoutErr = firstParam(sp.error);
  const checkoutOk = firstParam(sp.checkout) === 'success';
  const checkoutCanceled = firstParam(sp.checkout) === 'canceled';
  const emailSent = firstParam(sp.email) === 'sent';
  const refundOk = firstParam(sp.refund) === 'ok';

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

  const { data: tenantRow } = await db
    .from('tenants')
    .select('stripe_connect_status')
    .eq('id', membership.tenantId)
    .maybeSingle();

  const connectComplete = tenantRow?.stripe_connect_status === 'complete';

  const remaining = inv.amount_cents - inv.amount_paid_cents;

  return (
    <>
      <PageHeader title={inv.title} description={`Invoice · ${inv.status}`} />

      <p className={styles.backLinkWrap}>
        <Link href="/billing/invoices" className={styles.backLink}>
          ← All invoices
        </Link>
      </p>

      {checkoutErr ? (
        <p className={styles.bannerError} role="alert">
          {checkoutErr}
        </p>
      ) : null}
      {checkoutOk ? (
        <p className={styles.bannerOk} role="status">
          Checkout completed. If the balance did not clear, wait a few seconds and refresh — the webhook records the
          payment.
        </p>
      ) : null}
      {checkoutCanceled ? (
        <p className={styles.muted} role="status">
          Checkout canceled — no charge was made.
        </p>
      ) : null}
      {emailSent ? (
        <p className={styles.bannerOk} role="status">
          Invoice email sent to the customer&apos;s address on file.
        </p>
      ) : null}
      {refundOk ? (
        <p className={styles.bannerOk} role="status">
          Refund submitted in Stripe and a matching credit was applied to this invoice.
        </p>
      ) : null}

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

        {inv.status !== 'void' && isResendConfigured() ? (
          <Card
            title="Email customer"
            description="Sends a short summary with a link to the customer portal invoice page."
          >
            <form action={sendTenantInvoiceEmailAction} className={styles.resumeForm}>
              <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
              <input type="hidden" name="invoice_id" value={inv.id} />
              <Button type="submit" variant="secondary">
                Send invoice email
              </Button>
            </form>
          </Card>
        ) : inv.status !== 'void' && !isResendConfigured() ? (
          <Card title="Email customer" description="Set RESEND_API_KEY and RESEND_FROM_EMAIL to enable invoice emails from the app.">
            <p className={styles.muted}>Configure Resend in your server environment to unlock this action.</p>
          </Card>
        ) : null}

        {inv.status !== 'void' && remaining > 0 && connectComplete ? (
          <Card
            title="Pay online (card)"
            description="Opens Stripe Checkout on your connected account for the remaining balance."
          >
            <form action={createInvoicePayCheckoutSessionAction} className={styles.resumeForm}>
              <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
              <input type="hidden" name="invoice_id" value={inv.id} />
              <Button type="submit" variant="primary">
                Pay {formatUsdFromCents(remaining)} with card
              </Button>
            </form>
          </Card>
        ) : inv.status !== 'void' && remaining > 0 && !connectComplete ? (
          <Card title="Pay online (card)" description="Complete Stripe Connect under Billing → Payment setup to enable card checkout for this invoice.">
            <Button variant="secondary" as="a" href="/billing/payment-setup">
              Open payment setup
            </Button>
          </Card>
        ) : null}

        {inv.status !== 'void' && remaining > 0 ? (
          <Card title="Record payment" description="Manual cash, check, Zelle, ACH, or other (card uses Pay online above).">
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
              {payments.map((p) => {
                const refundable =
                  inv.status !== 'void' &&
                  connectComplete &&
                  p.recorded_via === 'stripe_checkout' &&
                  Boolean(p.stripe_charge_id) &&
                  p.amount_cents > 0;
                return (
                  <li key={p.id} style={{ marginBottom: 'var(--space-3)' }}>
                    <div>
                      <strong>{formatUsdFromCents(p.amount_cents)}</strong> · {paymentMethodLabel(p)} ·{' '}
                      {new Date(p.recorded_at).toLocaleString()}
                      {p.notes ? <span className={styles.muted}> — {p.notes}</span> : null}
                    </div>
                    {refundable ? (
                      <form action={refundStripeInvoicePaymentAction} className={styles.resumeForm} style={{ marginTop: 'var(--space-2)' }}>
                        <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                        <input type="hidden" name="invoice_id" value={inv.id} />
                        <input type="hidden" name="payment_id" value={p.id} />
                        <label className={styles.field}>
                          <span>Refund amount (USD), optional</span>
                          <input
                            name="refund_amount_dollars"
                            type="text"
                            className={styles.input}
                            placeholder={`Max ${(p.amount_cents / 100).toFixed(2)}`}
                          />
                        </label>
                        <Button type="submit" variant="secondary">
                          Refund in Stripe
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Stack>
    </>
  );
}
