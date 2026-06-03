import styles from './quotes.module.scss';

export function QuotePromotionFields({
  defaults,
  walletBalanceCents,
  promotionsEnabled = false,
}: {
  defaults?: {
    promoCode?: string;
    walletCreditDollars?: string;
  };
  walletBalanceCents?: number | null;
  promotionsEnabled?: boolean;
}) {
  if (!promotionsEnabled) return null;

  const balanceLabel =
    walletBalanceCents != null ? `$${(walletBalanceCents / 100).toFixed(2)} available` : null;

  return (
    <fieldset className={styles.pricingBlock}>
      <legend className={styles.pricingLegend}>Promotions & wallet</legend>
      <label className={styles.label} htmlFor="quote_promo_code">
        Promo code
      </label>
      <p className={styles.hint}>
        Applies a workspace discount code to this quote. Overrides manual quote-level discount when
        present.
      </p>
      <input
        id="quote_promo_code"
        name="promo_code"
        className={styles.input}
        defaultValue={defaults?.promoCode ?? ''}
        placeholder="SPRING20"
        autoComplete="off"
        spellCheck={false}
      />

      <label className={styles.label} htmlFor="quote_wallet_credit_dollars">
        Apply wallet credit ($)
      </label>
      <p className={styles.hint}>
        Deducts from the customer&apos;s account credit when they accept this quote.
        {balanceLabel ? ` ${balanceLabel}.` : ''}
      </p>
      <input
        id="quote_wallet_credit_dollars"
        name="wallet_credit_dollars"
        className={styles.input}
        inputMode="decimal"
        defaultValue={defaults?.walletCreditDollars ?? ''}
        placeholder="0.00"
      />
    </fieldset>
  );
}
