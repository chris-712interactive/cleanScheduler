'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { createTenantQuote, type QuoteFormState } from './actions';
import { QuoteLineItemsEditor } from './QuoteLineItemsEditor';
import { QuoteHeaderPricingFields } from './QuoteHeaderPricingFields';
import styles from './quotes.module.scss';

const initial: QuoteFormState = {};

export interface QuoteCustomerOption {
  id: string;
  label: string;
}

export interface CustomerPropertyGroup {
  customerId: string;
  options: { id: string; label: string }[];
}

export function QuoteCreateForm({
  tenantSlug,
  customerOptions,
  customerPropertyGroups,
}: {
  tenantSlug: string;
  customerOptions: QuoteCustomerOption[];
  customerPropertyGroups: CustomerPropertyGroup[];
}) {
  const [state, formAction, pending] = useActionState(createTenantQuote, initial);
  useRefreshOnServerActionSuccess(state.success);

  const [customerId, setCustomerId] = useState('');

  const propertyOptions = useMemo(() => {
    return customerPropertyGroups.find((g) => g.customerId === customerId)?.options ?? [];
  }, [customerPropertyGroups, customerId]);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Quote saved.
        </p>
      ) : null}

      <label className={styles.label} htmlFor="quote_title">
        Title
      </label>
      <input
        id="quote_title"
        name="title"
        className={styles.input}
        required
        placeholder="Deep clean — 3 BR townhouse"
      />

      <label className={styles.label} htmlFor="quote_customer">
        Customer (optional)
      </label>
      <select
        id="quote_customer"
        name="customer_id"
        className={styles.select}
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      >
        <option value="">— None —</option>
        {customerOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="quote_property">
        Service location (optional)
      </label>
      <select
        key={`prop_${customerId || 'none'}`}
        id="quote_property"
        name="property_id"
        className={styles.select}
        defaultValue=""
        disabled={!customerId || propertyOptions.length === 0}
      >
        <option value="">— None —</option>
        {propertyOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {customerId && propertyOptions.length === 0 ? (
        <p className={styles.hint}>Add service locations on the customer profile first.</p>
      ) : null}

      <QuoteLineItemsEditor />

      <QuoteHeaderPricingFields />

      <label className={styles.label} htmlFor="quote_amount">
        Amount (USD, optional)
      </label>
      <p className={styles.hint}>
        If you add priced service rows above, the saved total uses those lines (after line discounts), then
        quote-level discount and tax below. This single amount field is only used when there are no line
        items.
      </p>
      <input
        id="quote_amount"
        name="amount_dollars"
        className={styles.input}
        inputMode="decimal"
        placeholder="240.00"
      />

      <label className={styles.label} htmlFor="quote_valid">
        Valid until (optional)
      </label>
      <input id="quote_valid" name="valid_until" className={styles.input} type="date" />

      <label className={styles.label} htmlFor="quote_notes">
        Notes
      </label>
      <textarea id="quote_notes" name="notes" className={styles.textarea} placeholder="Scope, access, pets…" />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Create draft quote'}
      </button>
    </form>
  );
}
