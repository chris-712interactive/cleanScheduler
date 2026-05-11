'use client';

import { useActionState } from 'react';
import { updateTenantQuote, type QuoteFormState } from './actions';
import type { QuoteCustomerOption } from './QuoteCreateForm';
import type { QuoteStatus } from '@/lib/tenant/quoteLabels';
import { QUOTE_STATUS_OPTIONS } from '@/lib/tenant/quoteLabels';
import styles from './quotes.module.scss';

const initial: QuoteFormState = {};

export interface QuoteEditSnapshot {
  quoteId: string;
  title: string;
  status: QuoteStatus;
  customerId: string;
  amountCents: number | null;
  notes: string;
  validUntilYmd: string;
}

function formatAmountField(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

export function QuoteEditForm({
  tenantSlug,
  customerOptions,
  snapshot,
}: {
  tenantSlug: string;
  customerOptions: QuoteCustomerOption[];
  snapshot: QuoteEditSnapshot;
}) {
  const [state, formAction, pending] = useActionState(updateTenantQuote, initial);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="quote_id" value={snapshot.quoteId} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Saved.
        </p>
      ) : null}

      <label className={styles.label} htmlFor="edit_quote_title">
        Title
      </label>
      <input
        id="edit_quote_title"
        name="title"
        className={styles.input}
        required
        defaultValue={snapshot.title}
      />

      <label className={styles.label} htmlFor="edit_quote_status">
        Status
      </label>
      <select
        id="edit_quote_status"
        name="status"
        className={styles.select}
        defaultValue={snapshot.status}
      >
        {QUOTE_STATUS_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="edit_quote_customer">
        Customer (optional)
      </label>
      <select
        id="edit_quote_customer"
        name="customer_id"
        className={styles.select}
        defaultValue={snapshot.customerId}
      >
        <option value="">— None —</option>
        {customerOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="edit_quote_amount">
        Amount (USD)
      </label>
      <input
        id="edit_quote_amount"
        name="amount_dollars"
        className={styles.input}
        inputMode="decimal"
        defaultValue={formatAmountField(snapshot.amountCents)}
      />

      <label className={styles.label} htmlFor="edit_quote_valid">
        Valid until
      </label>
      <input
        id="edit_quote_valid"
        name="valid_until"
        className={styles.input}
        type="date"
        defaultValue={snapshot.validUntilYmd}
      />

      <label className={styles.label} htmlFor="edit_quote_notes">
        Notes
      </label>
      <textarea id="edit_quote_notes" name="notes" className={styles.textarea} defaultValue={snapshot.notes} />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
