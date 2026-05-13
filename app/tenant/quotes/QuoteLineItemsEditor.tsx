'use client';

import { useCallback, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { QUOTE_LINE_FREQUENCY_OPTIONS, parseQuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import type { QuoteLineDiscountKind } from '@/lib/tenant/quoteHeaderPricingForm';
import { QUOTE_LINE_DISCOUNT_OPTIONS } from '@/lib/tenant/quoteHeaderPricingForm';
import styles from './quotes.module.scss';

export type QuoteLineItemDraft = {
  key: string;
  service_label: string;
  frequency: QuoteLineFrequency;
  frequency_detail: string;
  amount_dollars: string;
  line_discount_kind: QuoteLineDiscountKind;
  line_discount_input: string;
};

type QuoteLineItemRow = Pick<
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

function discountInputFromRow(kind: QuoteLineDiscountKind, value: number): string {
  if (kind === 'none' || value <= 0) return '';
  if (kind === 'percent') return String(value / 100);
  return (value / 100).toFixed(2);
}

function emptyDraft(): QuoteLineItemDraft {
  return {
    key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `row_${Math.random()}`,
    service_label: '',
    frequency: 'one_time',
    frequency_detail: '',
    amount_dollars: '',
    line_discount_kind: 'none',
    line_discount_input: '',
  };
}

/** Maps persisted rows to editor state; preserves `sort_order`. */
export function draftsFromQuoteLineRows(
  rows: QuoteLineItemRow[] | null | undefined,
): QuoteLineItemDraft[] {
  if (!rows?.length) return [];
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => ({
      key: l.id,
      service_label: l.service_label,
      frequency: l.frequency,
      frequency_detail: l.frequency_detail ?? '',
      amount_dollars: (l.amount_cents / 100).toFixed(2),
      line_discount_kind: l.line_discount_kind,
      line_discount_input: discountInputFromRow(l.line_discount_kind, l.line_discount_value),
    }));
}

export function QuoteLineItemsEditor({
  initialRows,
}: {
  /** When empty or omitted, one blank row is shown for data entry. */
  initialRows?: QuoteLineItemRow[] | null;
}) {
  const [rows, setRows] = useState<QuoteLineItemDraft[]>(() => {
    const fromDb = draftsFromQuoteLineRows(initialRows ?? null);
    return fromDb.length > 0 ? fromDb : [emptyDraft()];
  });

  const updateRow = useCallback((key: string, patch: Partial<QuoteLineItemDraft>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyDraft()]);
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [emptyDraft()];
      }
      return prev.filter((r) => r.key !== key);
    });
  }, []);

  return (
    <fieldset className={styles.lineItemsFieldset}>
      <legend className={styles.lineItemsLegend}>Services &amp; pricing</legend>
      <p className={styles.lineItemsIntro}>
        Add one row per priced service. Cadence describes how often that price applies. Line discounts reduce
        that row&apos;s amount before the quote subtotal. If you enter any complete rows here, the header
        amount field below is ignored for the total (tax and quote-level discount still apply).
      </p>

      <div className={styles.lineItemsHeaderRow} aria-hidden="true">
        <span className={styles.lineItemsHeaderCell}>Service</span>
        <span className={styles.lineItemsHeaderCell}>Cadence</span>
        <span className={styles.lineItemsHeaderCell}>Cadence detail</span>
        <span className={styles.lineItemsHeaderCell}>List ($)</span>
        <span className={styles.lineItemsHeaderCell}>Line disc.</span>
        <span className={styles.lineItemsHeaderCell}>Disc. value</span>
        <span className={styles.lineItemsHeaderCellAction} />
      </div>

      <div className={styles.lineItemsRows}>
        {rows.map((row) => (
          <div key={row.key} className={styles.lineItemRow}>
            <input
              name="line_service"
              className={styles.input}
              placeholder="e.g. Deep clean, Weekly tidy"
              value={row.service_label}
              onChange={(e) => updateRow(row.key, { service_label: e.target.value })}
              aria-label="Service name"
            />
            <select
              name="line_frequency"
              className={styles.select}
              value={row.frequency}
              onChange={(e) => {
                const frequency = parseQuoteLineFrequency(e.target.value);
                updateRow(row.key, {
                  frequency,
                  frequency_detail: frequency === 'custom' ? row.frequency_detail : '',
                });
              }}
              aria-label="Cadence"
            >
              {QUOTE_LINE_FREQUENCY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              name="line_frequency_detail"
              className={
                row.frequency === 'custom' ? styles.input : `${styles.input} ${styles.visuallyHidden}`
              }
              placeholder={row.frequency === 'custom' ? 'e.g. Every other Thursday' : ''}
              value={row.frequency_detail}
              onChange={(e) => updateRow(row.key, { frequency_detail: e.target.value })}
              tabIndex={row.frequency === 'custom' ? 0 : -1}
              readOnly={row.frequency !== 'custom'}
              aria-label="Cadence detail"
            />
            <input
              name="line_amount"
              className={styles.input}
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount_dollars}
              onChange={(e) => updateRow(row.key, { amount_dollars: e.target.value })}
              aria-label="Line list amount USD"
            />
            <select
              name="line_discount_kind"
              className={styles.select}
              value={row.line_discount_kind}
              onChange={(e) => {
                const line_discount_kind = e.target.value as QuoteLineDiscountKind;
                updateRow(row.key, {
                  line_discount_kind,
                  line_discount_input: line_discount_kind === 'none' ? '' : row.line_discount_input,
                });
              }}
              aria-label="Line discount type"
            >
              {QUOTE_LINE_DISCOUNT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              name="line_discount_input"
              className={styles.input}
              inputMode="decimal"
              placeholder={row.line_discount_kind === 'percent' ? '%' : row.line_discount_kind === 'fixed_cents' ? '$' : '—'}
              value={row.line_discount_input}
              onChange={(e) => updateRow(row.key, { line_discount_input: e.target.value })}
              readOnly={row.line_discount_kind === 'none'}
              aria-label="Line discount value"
            />
            <div className={styles.lineItemActions}>
              <button
                type="button"
                className={styles.lineItemIconButton}
                onClick={() => removeRow(row.key)}
                aria-label="Remove service row"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={styles.lineItemAddButton} onClick={addRow}>
        <Plus size={18} aria-hidden />
        Add service
      </button>
    </fieldset>
  );
}
