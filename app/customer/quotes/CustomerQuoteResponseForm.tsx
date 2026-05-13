'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { respondToCustomerQuote, type CustomerQuoteResponseState } from './actions';
import styles from './quotes.module.scss';

const initial: CustomerQuoteResponseState = {};

export function CustomerQuoteResponseForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(respondToCustomerQuote, initial);
  useRefreshOnServerActionSuccess(state.success);

  return (
    <form action={action} className={styles.responseForm}>
      <input type="hidden" name="quote_id" value={quoteId} />
      {state.error ? (
        <p className={styles.responseError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.responseSuccess} role="status">
          Thank you — your response has been recorded.
        </p>
      ) : null}
      <div className={styles.responseActions}>
        <button type="submit" name="decision" value="accept" className={styles.acceptButton} disabled={pending}>
          {pending ? 'Working…' : 'Accept quote'}
        </button>
        <button type="submit" name="decision" value="decline" className={styles.declineButton} disabled={pending}>
          Decline
        </button>
      </div>
    </form>
  );
}
