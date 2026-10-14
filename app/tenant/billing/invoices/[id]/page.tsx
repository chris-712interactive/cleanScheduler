import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createInvoicePayCheckoutSessionAction } from '@/app/tenant/billing/invoiceCheckoutActions';
import { sendTenantInvoiceEmailAction } from '@/app/tenant/billing/invoiceEmailActions';
import { refundStripeInvoicePaymentAction } from '@/app/tenant/billing/invoiceRefundActions';
import { RecordInvoicePaymentForm } from './RecordInvoicePaymentForm';
import { formatUsdFromCents } from '@/lib/format/money';
import { isResendConfigured } from '@/lib/email/resend';
import { getInvoiceRelatedRecords } from '@/lib/tenant/relatedRecords';
import { RelatedRecordsPanel } from '@/app/tenant/RelatedRecordsPanel';
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

function paymentMethodLabel(p: { method: string; recorded_via?: string | null }): string {
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
  const paidNotice = checkoutErr === 'paid' || firstParam(sp.paid) === '1';
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
  const relatedRecords = await getInvoiceRelatedRecords(db, membership.tenantId, {
    id: inv.id,
    customer_id: inv.customer_id,
    visit_id: inv.visit_id,
  });

  return (
    <>
      <PageHeader
        title={inv.title}
        backHref="/billing/invoices"
        backLabel="Customer invoices"
        titleHint={`Invoice · ${inv.status}`}
      />

      {paidNotice ? (
        <p className={styles.bannerOk} role="status">
          Paid
        </p>
      ) : null}
      {checkoutErr && !paidNotice ? (
        <p className={styles.bannerError} role="alert">
          {checkoutErr}
        </p>
      ) : null}
      {checkoutOk ? (
        <p className={styles.bannerOk} role="status">
          Checkout completed. If the balance did not clear, wait a few seconds and refresh — the
          webhook records the payment.
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

      <div
        className={
          inv.status === 'void'
            ? `${styles.invoiceWorkspace} ${styles.invoiceWorkspaceSingle}`
            : styles.invoiceWorkspace
        }
      >
        {inv.status !== 'void' ? (
          <div className={styles.invoiceActions}>
            <Card title="Invoice actions">
              <p className={styles.invoiceBalance}>
                Balance due
                <strong>{formatUsdFromCents(Math.max(0, remaining))}</strong>
              </p>

              <div className={styles.invoiceActionGroup}>
                <p className={styles.invoiceActionLabel}>Resend invoice</p>
                {isResendConfigured() ? (
                  <>
                    <p className={styles.invoiceActionHint}>
                      Emails a summary and a link to the customer portal invoice.
                    </p>
                    <form action={sendTenantInvoiceEmailAction}>
                      <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                      <input type="hidden" name="invoice_id" value={inv.id} />
                      <Button type="submit" variant="secondary" fullWidth>
                        Send invoice email
                      </Button>
                    </form>
                  </>
                ) : (
                  <p className={styles.invoiceActionHint}>
                    Set RESEND_API_KEY and RESEND_FROM_EMAIL to send invoice email from the app.
                  </p>
                )}
              </div>

              {remaining > 0 ? (
                <div className={styles.invoiceActionGroup}>
                  <p className={styles.invoiceActionLabel}>Card payment</p>
                  {connectComplete ? (
                    <>
                      <p className={styles.invoiceActionHint}>
                        Opens Stripe Checkout for the remaining balance.
                      </p>
                      <form action={createInvoicePayCheckoutSessionAction}>
                        <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
                        <input type="hidden" name="invoice_id" value={inv.id} />
                        <Button type="submit" variant="primary" fullWidth>
                          Pay {formatUsdFromCents(remaining)} with card
                        </Button>
                      </form>
                    </>
                  ) : (
                    <>
                      <p className={styles.invoiceActionHint}>
                        Finish Stripe Connect before customers can pay this invoice by card.
                      </p>
                      <Button variant="primary" as="a" href="/billing/payment-setup" fullWidth>
                        Open payment setup
                      </Button>
                    </>
                  )}
                </div>
              ) : null}

              {remaining > 0 ? (
                <div className={styles.invoiceActionGroup}>
                  <p className={styles.invoiceActionLabel}>Record a payment</p>
                  <p className={styles.invoiceActionHint}>
                    Cash, check, Zelle, ACH, or other. Card payments use the button above.
                  </p>
                  <RecordInvoicePaymentForm
                    tenantSlug={membership.tenantSlug}
                    invoiceId={inv.id}
                    remainingCents={remaining}
                  />
                </div>
              ) : (
                <div className={styles.invoiceActionGroup}>
                  <p className={styles.invoiceActionHint}>This invoice is paid in full.</p>
                </div>
              )}
            </Card>
          </div>
        ) : null}

        <div className={styles.invoiceMain}>
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
                ...(inv.source === 'stripe_billing'
                  ? [{ key: 'Source', value: 'Stripe Billing subscription' }]
                  : []),
                ...(inv.last_payment_error
                  ? [{ key: 'Last payment error', value: inv.last_payment_error }]
                  : []),
              ]}
            />
            <div className={styles.invoiceSummaryLinks}>
              {inv.hosted_invoice_url ? (
                <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                  View on Stripe
                </a>
              ) : null}
              {inv.invoice_pdf_url ? (
                <a href={inv.invoice_pdf_url} target="_blank" rel="noopener noreferrer">
                  Stripe PDF
                </a>
              ) : null}
              <a href={`/api/tenant/billing/invoices/${inv.id}/pdf`}>Download PDF</a>
            </div>
          </Card>

          <RelatedRecordsPanel snapshot={relatedRecords} />

          <Card
            title="Payment history"
            description={payments?.length ? `${payments.length} entries` : 'No payments yet'}
          >
            {!payments?.length ? (
              <p className={styles.muted}>Payments appear here when recorded.</p>
            ) : (
              <ul className={styles.invoicePaymentList}>
                {payments.map((p) => {
                  const refundable =
                    inv.status !== 'void' &&
                    connectComplete &&
                    p.recorded_via === 'stripe_checkout' &&
                    Boolean(p.stripe_charge_id) &&
                    p.amount_cents > 0;
                  return (
                    <li key={p.id} className={styles.invoicePaymentItem}>
                      <div>
                        <strong>{formatUsdFromCents(p.amount_cents)}</strong> ·{' '}
                        {paymentMethodLabel(p)} · {new Date(p.recorded_at).toLocaleString()}
                        {p.notes ? <span className={styles.muted}> — {p.notes}</span> : null}
                      </div>
                      {refundable ? (
                        <form
                          action={refundStripeInvoicePaymentAction}
                          className={`${styles.resumeForm} ${styles.invoiceRefundForm}`}
                        >
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
        </div>
      </div>
    </>
  );
}
