import type { QuoteTotalsBreakdown } from '@/lib/tenant/quoteTotals';

/** Apply wallet credit after standard quote totals (post-tax). */
export function applyWalletCreditToQuoteTotal(
  totals: QuoteTotalsBreakdown,
  walletCreditCents: number,
): { total_cents: number; wallet_credit_applied_cents: number } {
  const credit = Math.max(0, Math.round(walletCreditCents));
  if (credit <= 0) {
    return { total_cents: totals.total_cents, wallet_credit_applied_cents: 0 };
  }
  const applied = Math.min(credit, totals.total_cents);
  return {
    total_cents: Math.max(0, totals.total_cents - applied),
    wallet_credit_applied_cents: applied,
  };
}
