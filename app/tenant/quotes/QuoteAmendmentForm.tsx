'use client';

import { useActionState } from 'react';
import { createTenantQuoteAmendment, type AmendmentFormState } from './actions';
import styles from './quotes.module.scss';

const initial: AmendmentFormState = {};

export function QuoteAmendmentForm({
  tenantSlug,
  priorQuoteId,
}: {
  tenantSlug: string;
  priorQuoteId: string;
}) {
  const [state, formAction, pending] = useActionState(createTenantQuoteAmendment, initial);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="prior_quote_id" value={priorQuoteId} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="version_reason">
        Reason for new version <span className={styles.requiredMark}>(required)</span>
      </label>
      <textarea
        id="version_reason"
        name="version_reason"
        className={styles.textarea}
        required
        minLength={5}
        rows={3}
        placeholder="e.g. Customer requested additional weekly visits after signing."
      />
      <p className={styles.hint}>
        The accepted quote stays frozen for the record. A new draft quote is created as the next
        version in this quote&apos;s history.
      </p>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Creating…' : 'Create new version (draft)'}
      </button>
    </form>
  );
}
