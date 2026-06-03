import { computeQuoteTotals, type ComputeQuoteTotalsInput } from '@/lib/tenant/quoteTotals';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import type { Database } from '@/lib/supabase/database.types';
import styles from './quotes.module.scss';

type QuoteTaxMode = Database['public']['Enums']['quote_tax_mode'];

function taxLabel(taxMode: QuoteTaxMode, taxRateBps: number): string | null {
  if (taxMode !== 'exclusive' || taxRateBps <= 0) return null;
  return `Sales tax (${(taxRateBps / 100).toFixed(3).replace(/\.?0+$/, '')}%)`;
}

export function CustomerQuoteTotalsBreakdown({
  input,
  currency,
  amountCents,
  appliedPromoCode,
  walletCreditAppliedCents = 0,
}: {
  input: ComputeQuoteTotalsInput;
  currency: string;
  amountCents: number | null;
  appliedPromoCode?: string | null;
  walletCreditAppliedCents?: number;
}) {
  const totals = computeQuoteTotals(input);
  const tax = taxLabel(input.tax_mode, input.tax_rate_bps);
  const hasBreakdown =
    totals.quote_discount_cents > 0 ||
    walletCreditAppliedCents > 0 ||
    Boolean(appliedPromoCode?.trim()) ||
    (tax != null && totals.tax_cents > 0);

  if (!hasBreakdown) {
    return null;
  }

  return (
    <details className={styles.breakdownDetails}>
      <summary className={styles.breakdownSummary}>Price breakdown</summary>
      <dl className={styles.breakdownRows}>
        <div className={styles.breakdownRow}>
          <dt>Services subtotal</dt>
          <dd>{formatQuoteMoney(totals.subtotal_after_line_discounts, currency)}</dd>
        </div>
        {totals.quote_discount_cents > 0 ? (
          <div className={styles.breakdownRow}>
            <dt>{appliedPromoCode?.trim() ? `Promo (${appliedPromoCode})` : 'Quote discount'}</dt>
            <dd>−{formatQuoteMoney(totals.quote_discount_cents, currency)}</dd>
          </div>
        ) : null}
        {tax ? (
          <div className={styles.breakdownRow}>
            <dt>{tax}</dt>
            <dd>+{formatQuoteMoney(totals.tax_cents, currency)}</dd>
          </div>
        ) : null}
        {walletCreditAppliedCents > 0 ? (
          <div className={styles.breakdownRow}>
            <dt>Account credit</dt>
            <dd>−{formatQuoteMoney(walletCreditAppliedCents, currency)}</dd>
          </div>
        ) : null}
        <div className={`${styles.breakdownRow} ${styles.breakdownRowTotal}`}>
          <dt>Total</dt>
          <dd>{formatQuoteMoney(amountCents ?? totals.total_cents, currency)}</dd>
        </div>
      </dl>
    </details>
  );
}
