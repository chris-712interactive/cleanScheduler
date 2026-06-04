import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { formatUsdFromCents } from '@/lib/format/money';
import { createCustomerInvoicePayCheckoutSessionAction } from '@/app/customer/invoices/invoicePayCheckoutActions';
import { CustomerInvoicePromotionPanel } from '@/app/customer/invoices/CustomerInvoicePromotionPanel';
import { customerPromotionsEnabledForTenant } from '@/lib/promotions/loadCustomerWalletPortal';
import { getCustomerWalletBalanceCents } from '@/lib/promotions/customerWallet';
import {
  invoiceCollectibleCents,
  invoicePromotionDefaults,
} from '@/lib/promotions/applyCustomerInvoicePromotions';
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
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  source: string | null;
  applied_promo_code: string | null;
  promo_discount_cents: number;
  wallet_credit_applied_cents: number;
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
      hosted_invoice_url,
      invoice_pdf_url,
      source,
      applied_promo_code,
      promo_discount_cents,
      wallet_credit_applied_cents,
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
  const unpaid = row.amount_cents - row.amount_paid_cents;
  const promoDiscount = row.promo_discount_cents ?? 0;
  const walletCredit = row.wallet_credit_applied_cents ?? 0;
  const collectible = invoiceCollectibleCents(row);
  const canPayOnline = connectComplete && collectible > 0 && row.status !== 'void';
  const stripeHostedPay = Boolean(row.hosted_invoice_url?.trim());
  const showPromotions =
    !stripeHostedPay && row.status !== 'void' && row.status !== 'paid' && unpaid > 0;

  const admin = createAdminClient();
  const promotionsEnabled = showPromotions
    ? await customerPromotionsEnabledForTenant(admin, row.tenant_id)
    : false;
  const walletBalanceCents =
    promotionsEnabled && showPromotions
      ? await getCustomerWalletBalanceCents(admin, row.tenant_id, row.customer_id)
      : 0;
  const promotionDefaults = invoicePromotionDefaults(row);

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
          Invoice total {formatUsdFromCents(row.amount_cents)} · Paid{' '}
          {formatUsdFromCents(row.amount_paid_cents)}
        </p>
        {promoDiscount > 0 || walletCredit > 0 ? (
          <ul className={styles.balanceBreakdown}>
            {promoDiscount > 0 ? (
              <li>
                Promo discount
                {row.applied_promo_code ? ` (${row.applied_promo_code})` : ''}: −
                {formatUsdFromCents(promoDiscount)}
              </li>
            ) : null}
            {walletCredit > 0 ? (
              <li>Account credit applied: −{formatUsdFromCents(walletCredit)}</li>
            ) : null}
          </ul>
        ) : null}
        <p className={styles.meta}>
          Balance due <strong>{formatUsdFromCents(Math.max(0, collectible))}</strong>
        </p>
        {row.due_date ? (
          <p className={styles.meta}>Due {new Date(String(row.due_date)).toLocaleDateString()}</p>
        ) : null}

        {promotionsEnabled && showPromotions ? (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <CustomerInvoicePromotionPanel
              invoiceId={row.id}
              walletBalanceCents={walletBalanceCents}
              defaults={promotionDefaults}
            />
          </div>
        ) : null}

        {stripeHostedPay ? (
          <div
            style={{
              marginTop: 'var(--space-3)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <a
              href={row.hosted_invoice_url!}
              className={styles.meta}
              target="_blank"
              rel="noopener noreferrer"
            >
              View & pay on Stripe →
            </a>
            {row.invoice_pdf_url ? (
              <a
                href={row.invoice_pdf_url}
                className={styles.meta}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download PDF →
              </a>
            ) : null}
          </div>
        ) : canPayOnline ? (
          <form
            action={createCustomerInvoicePayCheckoutSessionAction}
            style={{ marginTop: 'var(--space-3)' }}
          >
            <input type="hidden" name="invoice_id" value={row.id} />
            <Button type="submit" variant="primary">
              Pay {formatUsdFromCents(collectible)} with card
            </Button>
          </form>
        ) : collectible > 0 ? (
          <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
            Online card payment becomes available when this provider finishes Stripe Connect setup.
            You can pay them using the methods they accept outside the app.
          </p>
        ) : null}
        <p className={styles.meta} style={{ marginTop: 'var(--space-3)' }}>
          <a href={`/api/customer/invoices/${row.id}/pdf`}>Download invoice PDF</a>
        </p>
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
                <span className={styles.muted}>
                  {' '}
                  · {new Date(String(p.recorded_at)).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
