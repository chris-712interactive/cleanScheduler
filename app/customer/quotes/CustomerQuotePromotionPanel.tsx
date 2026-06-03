'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  applyCustomerQuotePromotionsAction,
  type CustomerQuotePromotionActionState,
} from './actions';
import styles from './quotes.module.scss';

const initialState: CustomerQuotePromotionActionState = {};

export function CustomerQuotePromotionPanel({
  quoteId,
  walletBalanceCents,
  defaults,
}: {
  quoteId: string;
  walletBalanceCents: number;
  defaults?: {
    promoCode?: string;
    walletCreditDollars?: string;
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(applyCustomerQuotePromotionsAction, initialState);
  const refreshedForSuccess = useRef(false);

  useEffect(() => {
    if (!state.success || refreshedForSuccess.current) return;
    refreshedForSuccess.current = true;
    router.refresh();
  }, [state.success, router]);

  const balanceLabel = `$${(walletBalanceCents / 100).toFixed(2)} available`;

  return (
    <section className={styles.promotionPanel} aria-labelledby={`quote-promo-${quoteId}`}>
      <h3 id={`quote-promo-${quoteId}`} className={styles.promotionPanelTitle}>
        Promotions & credit
      </h3>
      <p className={styles.promotionPanelHint}>
        Apply a promo code or account credit before you accept. Your total updates when you click
        Apply.
      </p>

      <form
        action={action}
        className={styles.promotionForm}
        key={state.success ? 'applied' : 'edit'}
      >
        <input type="hidden" name="quote_id" value={quoteId} />

        {state.error ? (
          <p className={styles.responseError} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className={styles.promotionSuccess} role="status">
            Quote total updated with your promotions.
          </p>
        ) : null}

        <label className={styles.promotionLabel} htmlFor={`customer_quote_promo_${quoteId}`}>
          Promo code
        </label>
        <input
          id={`customer_quote_promo_${quoteId}`}
          name="promo_code"
          className={styles.input}
          defaultValue={defaults?.promoCode ?? ''}
          placeholder="Enter code"
          autoComplete="off"
          spellCheck={false}
        />

        <label className={styles.promotionLabel} htmlFor={`customer_quote_wallet_${quoteId}`}>
          Apply account credit ($)
        </label>
        <p className={styles.promotionFieldHint}>{balanceLabel}</p>
        <input
          id={`customer_quote_wallet_${quoteId}`}
          name="wallet_credit_dollars"
          className={styles.input}
          inputMode="decimal"
          defaultValue={defaults?.walletCreditDollars ?? ''}
          placeholder="0.00"
        />

        <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
          Apply to quote
        </Button>
      </form>
    </section>
  );
}
