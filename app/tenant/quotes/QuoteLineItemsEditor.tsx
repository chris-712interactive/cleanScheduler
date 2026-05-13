'use client';

import { useCallback, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { QUOTE_LINE_FREQUENCY_OPTIONS, parseQuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import styles from './quotes.module.scss';

export type QuoteLineItemDraft = {
  key: string;
  service_label: string;
  frequency: QuoteLineFrequency;
  frequency_detail: string;
  amount_dollars: string;
};

type QuoteLineItemRow = Pick<
  Tables<'tenant_quote_line_items'>,
  'id' | 'sort_order' | 'service_label' | 'frequency' | 'frequency_detail' | 'amount_cents'
>;

function emptyDraft(): QuoteLineItemDraft {
  return {
    key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `row_${Math.random()}`,
    service_label: '',
    frequency: 'one_time',
    frequency_detail: '',
    amount_dollars: '',
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
        Add one row per priced service. Cadence describes how often that price applies (for example weekly
        maintenance vs one-time deep clean). If you enter any rows here, the quote total is the sum of line
        amounts and the single &quot;Amount&quot; field below is ignored on save.
      </p>

      <div className={styles.lineItemsHeaderRow} aria-hidden="true">
        <span className={styles.lineItemsHeaderCell}>Service</span>
        <span className={styles.lineItemsHeaderCell}>Cadence</span>
        <span className={styles.lineItemsHeaderCell}>Cadence detail</span>
        <span className={styles.lineItemsHeaderCell}>Amount (USD)</span>
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
              aria-label="Line amount USD"
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
