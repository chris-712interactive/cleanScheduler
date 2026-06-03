'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { redeemCustomerCreditCodeAction, type CustomerWalletActionState } from './walletActions';
import styles from './customers.module.scss';

const initialState: CustomerWalletActionState = {};

export function CustomerWalletPanel({
  tenantSlug,
  customerId,
  balanceCents,
  canEdit,
}: {
  tenantSlug: string;
  customerId: string;
  balanceCents: number;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(redeemCustomerCreditCodeAction, initialState);
  const displayBalance = state.balanceAfterCents ?? balanceCents;

  return (
    <section className={styles.walletPanel}>
      <p className={styles.walletBalance}>
        Available balance: <strong>${(displayBalance / 100).toFixed(2)}</strong>
      </p>
      <p className={styles.sectionHint}>
        Redeem account-credit promo codes below. Staff can apply the balance when editing a quote.
      </p>

      {canEdit ? (
        <form action={formAction} className={styles.walletForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="customer_id" value={customerId} />
          <label className={styles.label} htmlFor="customer_credit_code">
            Redeem credit code
          </label>
          <div className={styles.walletFormRow}>
            <input
              id="customer_credit_code"
              name="credit_code"
              className={styles.input}
              placeholder="WELCOME25"
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Redeem
            </Button>
          </div>
          {state.error ? (
            <p className={styles.bannerError} role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className={styles.bannerOk} role="status">
              Added ${((state.grantedCents ?? 0) / 100).toFixed(2)} to this customer&apos;s wallet.
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
