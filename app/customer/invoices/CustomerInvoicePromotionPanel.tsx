'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  applyCustomerInvoicePromotionsAction,
  type CustomerInvoicePromotionActionState,
} from './invoicePromotionActions';
import styles from './invoices.module.scss';

const initialState: CustomerInvoicePromotionActionState = {};

export function CustomerInvoicePromotionPanel({
  invoiceId,
  walletBalanceCents,
  defaults,
}: {
  invoiceId: string;
  walletBalanceCents: number;
  defaults?: {
    promoCode?: string;
    walletCreditDollars?: string;
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    applyCustomerInvoicePromotionsAction,
    initialState,
  );
  const refreshedForSuccess = useRef(false);

  useEffect(() => {
    if (!state.success || refreshedForSuccess.current) return;
    refreshedForSuccess.current = true;
    router.refresh();
  }, [state.success, router]);

  const balanceLabel = `$${(walletBalanceCents / 100).toFixed(2)} available`;

  return (
    <section className={styles.promotionPanel} aria-labelledby={`invoice-promo-${invoiceId}`}>
      <h3 id={`invoice-promo-${invoiceId}`} className={styles.promotionPanelTitle}>
        Promotions & credit
      </h3>
      <p className={styles.promotionPanelHint}>
        Apply a promo code or account credit before paying online. Click Apply to update your
        balance due.
      </p>

      <form
        action={action}
        className={styles.promotionForm}
        key={state.success ? 'applied' : 'edit'}
      >
        <input type="hidden" name="invoice_id" value={invoiceId} />

        {state.error ? (
          <p className={styles.bannerError} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className={styles.bannerOk} role="status">
            Balance due updated with your promotions.
          </p>
        ) : null}

        <label className={styles.promotionLabel} htmlFor={`customer_invoice_promo_${invoiceId}`}>
          Promo code
        </label>
        <input
          id={`customer_invoice_promo_${invoiceId}`}
          name="promo_code"
          className={styles.promotionInput}
          defaultValue={defaults?.promoCode ?? ''}
          placeholder="Enter code"
          autoComplete="off"
          spellCheck={false}
        />

        <label className={styles.promotionLabel} htmlFor={`customer_invoice_wallet_${invoiceId}`}>
          Apply account credit ($)
        </label>
        <p className={styles.promotionFieldHint}>{balanceLabel}</p>
        <input
          id={`customer_invoice_wallet_${invoiceId}`}
          name="wallet_credit_dollars"
          className={styles.promotionInput}
          inputMode="decimal"
          defaultValue={defaults?.walletCreditDollars ?? ''}
          placeholder="0.00"
        />

        <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
          Apply to invoice
        </Button>
      </form>
    </section>
  );
}
