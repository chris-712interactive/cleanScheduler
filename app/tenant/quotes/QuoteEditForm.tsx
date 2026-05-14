'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { updateTenantQuote, type QuoteFormState } from './actions';
import type { QuoteCustomerOption } from './QuoteCreateForm';
import type { CustomerPropertyGroup } from './QuoteCreateForm';
import type { QuoteStatus } from '@/lib/tenant/quoteLabels';
import { QUOTE_STATUS_LABEL, TENANT_QUOTE_STATUS_EDIT_OPTIONS } from '@/lib/tenant/quoteLabels';
import type { Tables } from '@/lib/supabase/database.types';
import { QuoteLineItemsEditor } from './QuoteLineItemsEditor';
import {
  QuoteHeaderPricingFields,
  type QuoteHeaderPricingDefaults,
} from './QuoteHeaderPricingFields';
import styles from './quotes.module.scss';

const initial: QuoteFormState = {};

export type QuoteEditLineItem = Pick<
  Tables<'tenant_quote_line_items'>,
  | 'id'
  | 'sort_order'
  | 'service_label'
  | 'frequency'
  | 'frequency_detail'
  | 'amount_cents'
  | 'line_discount_kind'
  | 'line_discount_value'
>;

export interface QuoteEditSnapshot {
  quoteId: string;
  title: string;
  status: QuoteStatus;
  customerId: string;
  propertyId: string;
  amountCents: number | null;
  notes: string;
  validUntilYmd: string;
  lineItems: QuoteEditLineItem[];
  headerPricing: QuoteHeaderPricingDefaults;
}

function formatAmountField(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

export function QuoteEditForm({
  tenantSlug,
  customerOptions,
  customerPropertyGroups,
  snapshot,
  readOnly = false,
}: {
  tenantSlug: string;
  customerOptions: QuoteCustomerOption[];
  customerPropertyGroups: CustomerPropertyGroup[];
  snapshot: QuoteEditSnapshot;
  /** When true, quote was accepted (frozen); show notice instead of the form. */
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTenantQuote, initial);
  useRefreshOnServerActionSuccess(state.success);

  const [customerId, setCustomerId] = useState(snapshot.customerId);

  const propertyOptions = useMemo(() => {
    return customerPropertyGroups.find((g) => g.customerId === customerId)?.options ?? [];
  }, [customerPropertyGroups, customerId]);

  const propertyDefault = propertyOptions.some((p) => p.id === snapshot.propertyId)
    ? snapshot.propertyId
    : '';

  const statusSelectOptions = useMemo(() => {
    const base = [...TENANT_QUOTE_STATUS_EDIT_OPTIONS];
    if (!base.some((o) => o.value === snapshot.status)) {
      base.unshift({
        value: snapshot.status,
        label: `${QUOTE_STATUS_LABEL[snapshot.status]} (current)`,
      });
    }
    return base;
  }, [snapshot.status]);

  if (readOnly) {
    return (
      <div className={styles.readOnlyNotice} role="status">
        This quote can no longer be edited here. Accepted quotes are frozen for the record; expired
        quotes cannot be reopened. To change terms, use <strong>Create new version</strong> in
        version history when that applies, or create a new quote for the customer.
      </div>
    );
  }

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
        {statusSelectOptions.map(({ value, label }) => (
          <option
            key={value}
            value={value}
            disabled={!TENANT_QUOTE_STATUS_EDIT_OPTIONS.some((o) => o.value === value)}
          >
            {label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="edit_quote_customer">
        Customer
      </label>
      <select
        id="edit_quote_customer"
        name="customer_id"
        className={styles.select}
        required
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      >
        <option value="" disabled>
          — Select —
        </option>
        {customerOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="edit_quote_property">
        Service location (optional)
      </label>
      <select
        key={`edit_prop_${customerId || 'none'}`}
        id="edit_quote_property"
        name="property_id"
        className={styles.select}
        defaultValue={propertyDefault}
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

      <QuoteLineItemsEditor key={snapshot.quoteId} initialRows={snapshot.lineItems} />

      <QuoteHeaderPricingFields defaults={snapshot.headerPricing} />

      <label className={styles.label} htmlFor="edit_quote_amount">
        Amount (USD, optional if lines above)
      </label>
      <p className={styles.hint}>
        When line items are present, the saved total is computed from those lines (after line
        discounts), then quote-level discount and tax. This field is only used when there are no
        line items.
      </p>
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
      <textarea
        id="edit_quote_notes"
        name="notes"
        className={styles.textarea}
        defaultValue={snapshot.notes}
      />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
