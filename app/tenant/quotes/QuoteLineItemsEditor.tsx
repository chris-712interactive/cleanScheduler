'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import {
  QUOTE_LINE_FREQUENCY_OPTIONS,
  parseQuoteLineFrequency,
} from '@/lib/tenant/quoteLineFrequency';
import type { QuoteLineDiscountKind } from '@/lib/tenant/quoteHeaderPricingForm';
import { QUOTE_LINE_DISCOUNT_OPTIONS } from '@/lib/tenant/quoteHeaderPricingForm';
import type { QuoteLinePricingMethod } from '@/lib/tenant/quoteLinePricingMethod';
import { QUOTE_LINE_PRICING_METHOD_OPTIONS } from '@/lib/tenant/quoteLinePricingMethod';
import {
  defaultAutoScheduleVisitCount,
  isRecurringQuoteLineFrequency,
} from '@/lib/tenant/quoteLineAutoSchedule';
import { findCatalogEntry, type JobTypeCatalogEntry } from '@/lib/tenant/jobTypeCatalog';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import styles from './quotes.module.scss';

export type QuoteLineItemDraft = {
  key: string;
  service_label: string;
  service_template_id: string;
  frequency: QuoteLineFrequency;
  frequency_detail: string;
  amount_dollars: string;
  line_discount_kind: QuoteLineDiscountKind;
  line_discount_input: string;
  pricing_method: QuoteLinePricingMethod;
  estimated_hours: string;
  auto_schedule_on_accept: boolean;
  auto_schedule_visit_count: string;
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
  | 'pricing_method'
  | 'estimated_hours'
  | 'auto_schedule_on_accept'
  | 'auto_schedule_visit_count'
  | 'service_template_id'
>;

function discountInputFromRow(kind: QuoteLineDiscountKind, value: number): string {
  if (kind === 'none' || value <= 0) return '';
  if (kind === 'percent') return String(value / 100);
  return (value / 100).toFixed(2);
}

export function createEmptyQuoteLineDraft(): QuoteLineItemDraft {
  return {
    key:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `row_${Math.random()}`,
    service_label: '',
    service_template_id: '',
    frequency: 'one_time',
    frequency_detail: '',
    amount_dollars: '',
    line_discount_kind: 'none',
    line_discount_input: '',
    pricing_method: 'flat',
    estimated_hours: '',
    auto_schedule_on_accept: false,
    auto_schedule_visit_count: '',
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
      service_template_id: l.service_template_id ?? '',
      frequency: l.frequency,
      frequency_detail: l.frequency_detail ?? '',
      amount_dollars: (l.amount_cents / 100).toFixed(2),
      line_discount_kind: l.line_discount_kind,
      line_discount_input: discountInputFromRow(l.line_discount_kind, l.line_discount_value),
      pricing_method: l.pricing_method ?? 'flat',
      estimated_hours:
        l.estimated_hours != null && Number(l.estimated_hours) > 0 ? String(l.estimated_hours) : '',
      auto_schedule_on_accept: l.auto_schedule_on_accept ?? false,
      auto_schedule_visit_count:
        l.auto_schedule_visit_count != null && l.auto_schedule_visit_count > 0
          ? String(l.auto_schedule_visit_count)
          : l.auto_schedule_on_accept && isRecurringQuoteLineFrequency(l.frequency)
            ? String(defaultAutoScheduleVisitCount(l.frequency))
            : '',
    }));
}

function catalogDefaultHoursForRow(
  row: QuoteLineItemDraft,
  catalog: JobTypeCatalogEntry[],
  propertyKind?: CustomerPropertyKind | null,
): number | null {
  const entry = findCatalogEntry(catalog, {
    serviceTemplateId: row.service_template_id || null,
    serviceLabel: row.service_label,
    propertyKind,
  });
  return entry?.estimated_hours ?? null;
}

function AutoScheduleFields({
  row,
  updateRow,
  catalogDefaultHours,
  autoScheduleEnabled,
}: {
  row: QuoteLineItemDraft;
  updateRow: (key: string, patch: Partial<QuoteLineItemDraft>) => void;
  catalogDefaultHours: number | null;
  autoScheduleEnabled: boolean;
}) {
  if (!autoScheduleEnabled) {
    return (
      <div className={styles.lineItemAutoSchedule}>
        <p className={styles.lineItemAutoScheduleHint}>
          Automatic scheduling is off for this workspace. Turn it on under{' '}
          <a href="/settings/operations" className={styles.inlineLink}>
            Settings → Operations
          </a>{' '}
          to flag lines for visits when a customer accepts.
        </p>
        <input type="hidden" name="line_auto_schedule" value="false" readOnly />
        <input
          name="line_estimated_hours"
          className={styles.visuallyHidden}
          value=""
          readOnly
          tabIndex={-1}
          aria-hidden
        />
        <input
          name="line_auto_schedule_visit_count"
          className={styles.visuallyHidden}
          value=""
          readOnly
          tabIndex={-1}
          aria-hidden
        />
      </div>
    );
  }

  const showVisitCount =
    row.auto_schedule_on_accept && isRecurringQuoteLineFrequency(row.frequency);

  return (
    <div className={styles.lineItemAutoSchedule}>
      <label className={styles.lineItemAutoScheduleLabel} htmlFor={`line_auto_schedule_${row.key}`}>
        <input
          id={`line_auto_schedule_${row.key}`}
          type="checkbox"
          checked={row.auto_schedule_on_accept}
          onChange={(e) => {
            const auto_schedule_on_accept = e.target.checked;
            updateRow(row.key, {
              auto_schedule_on_accept,
              auto_schedule_visit_count:
                auto_schedule_on_accept && isRecurringQuoteLineFrequency(row.frequency)
                  ? row.auto_schedule_visit_count ||
                    String(defaultAutoScheduleVisitCount(row.frequency))
                  : '',
              estimated_hours: auto_schedule_on_accept ? row.estimated_hours : '',
            });
          }}
        />
        <span>
          Auto-schedule on accept
          <span className={styles.lineItemAutoScheduleHint}>
            {' '}
            — create visits for this line when the customer accepts.
          </span>
        </span>
      </label>
      <input
        type="hidden"
        name="line_auto_schedule"
        value={row.auto_schedule_on_accept ? 'true' : 'false'}
        readOnly
      />
      {row.auto_schedule_on_accept ? (
        <>
          <label className={styles.label} htmlFor={`line_visit_duration_${row.key}`}>
            Visit duration (hours)
          </label>
          <input
            id={`line_visit_duration_${row.key}`}
            name="line_estimated_hours"
            className={`${styles.input} ${styles.lineItemAutoScheduleCount}`}
            inputMode="decimal"
            placeholder={
              catalogDefaultHours != null ? `Default: ${catalogDefaultHours}` : 'Default: 2'
            }
            value={row.estimated_hours}
            onChange={(e) => updateRow(row.key, { estimated_hours: e.target.value })}
          />
          <p className={styles.lineItemAutoScheduleHint}>
            Optional override for this customer. Leave blank to use the default from{' '}
            <a href="/settings/services" className={styles.inlineLink}>
              Service types
            </a>
            .
          </p>
        </>
      ) : (
        <input
          name="line_estimated_hours"
          className={styles.visuallyHidden}
          value=""
          readOnly
          tabIndex={-1}
          aria-hidden
        />
      )}
      {showVisitCount ? (
        <>
          <label className={styles.label} htmlFor={`line_auto_schedule_count_${row.key}`}>
            Visits to schedule initially
          </label>
          <input
            id={`line_auto_schedule_count_${row.key}`}
            name="line_auto_schedule_visit_count"
            className={`${styles.input} ${styles.lineItemAutoScheduleCount}`}
            inputMode="numeric"
            min={1}
            max={52}
            placeholder={String(defaultAutoScheduleVisitCount(row.frequency))}
            value={row.auto_schedule_visit_count}
            onChange={(e) => updateRow(row.key, { auto_schedule_visit_count: e.target.value })}
          />
          <p className={styles.lineItemAutoScheduleHint}>
            For recurring lines, how many upcoming visits to book now (e.g. deep clean once, or 4
            weekly cleans).
          </p>
        </>
      ) : (
        <input
          name="line_auto_schedule_visit_count"
          className={styles.visuallyHidden}
          value=""
          readOnly
          tabIndex={-1}
          aria-hidden
        />
      )}
    </div>
  );
}

function LineItemFields({
  row,
  updateRow,
  layout,
  catalog,
  propertyKind,
}: {
  row: QuoteLineItemDraft;
  updateRow: (key: string, patch: Partial<QuoteLineItemDraft>) => void;
  layout: 'grid' | 'cards';
  catalog: JobTypeCatalogEntry[];
  propertyKind?: CustomerPropertyKind | null;
}) {
  const serviceSuggestions = [
    ...new Set(
      catalog
        .filter((entry) => !propertyKind || entry.job_type === propertyKind)
        .map((entry) => entry.service_label),
    ),
  ].sort();

  const syncCatalogMatch = (serviceLabel: string) => {
    const entry = findCatalogEntry(catalog, { serviceLabel, propertyKind });
    return {
      service_template_id: entry?.id ?? '',
    };
  };

  if (layout === 'cards') {
    return (
      <div className={styles.lineItemCardFields}>
        <label className={styles.label} htmlFor={`line_service_${row.key}`}>
          Service
        </label>
        <input
          id={`line_service_${row.key}`}
          name="line_service"
          className={styles.input}
          list={`line_service_suggestions_${row.key}`}
          placeholder="e.g. Deep cleaning"
          value={row.service_label}
          onChange={(e) => {
            const service_label = e.target.value;
            updateRow(row.key, { service_label, ...syncCatalogMatch(service_label) });
          }}
        />
        <datalist id={`line_service_suggestions_${row.key}`}>
          {serviceSuggestions.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        <input
          type="hidden"
          name="line_service_template_id"
          value={row.service_template_id}
          readOnly
        />
        <div className={styles.lineItemCardGrid}>
          <div>
            <label className={styles.label} htmlFor={`line_frequency_${row.key}`}>
              Cadence
            </label>
            <select
              id={`line_frequency_${row.key}`}
              name="line_frequency"
              className={styles.select}
              value={row.frequency}
              onChange={(e) => {
                const frequency = parseQuoteLineFrequency(e.target.value);
                updateRow(row.key, {
                  frequency,
                  frequency_detail: frequency === 'custom' ? row.frequency_detail : '',
                  auto_schedule_visit_count:
                    row.auto_schedule_on_accept && isRecurringQuoteLineFrequency(frequency)
                      ? row.auto_schedule_visit_count ||
                        String(defaultAutoScheduleVisitCount(frequency))
                      : '',
                });
              }}
            >
              {QUOTE_LINE_FREQUENCY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={styles.label} htmlFor={`line_amount_${row.key}`}>
              List price ($)
            </label>
            <input
              id={`line_amount_${row.key}`}
              name="line_amount"
              className={styles.input}
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount_dollars}
              onChange={(e) => updateRow(row.key, { amount_dollars: e.target.value })}
            />
          </div>
        </div>
        {row.frequency === 'custom' ? (
          <>
            <label className={styles.label} htmlFor={`line_detail_${row.key}`}>
              Cadence detail
            </label>
            <input
              id={`line_detail_${row.key}`}
              name="line_frequency_detail"
              className={styles.input}
              placeholder="e.g. Every other Thursday"
              value={row.frequency_detail}
              onChange={(e) => updateRow(row.key, { frequency_detail: e.target.value })}
            />
          </>
        ) : (
          <input
            name="line_frequency_detail"
            className={styles.visuallyHidden}
            value=""
            readOnly
            tabIndex={-1}
            aria-hidden
          />
        )}
        <div className={styles.lineItemCardGrid}>
          <div>
            <label className={styles.label} htmlFor={`line_disc_kind_${row.key}`}>
              Line discount
            </label>
            <select
              id={`line_disc_kind_${row.key}`}
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
            >
              {QUOTE_LINE_DISCOUNT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={styles.label} htmlFor={`line_disc_val_${row.key}`}>
              Discount value
            </label>
            <input
              id={`line_disc_val_${row.key}`}
              name="line_discount_input"
              className={styles.input}
              inputMode="decimal"
              placeholder={
                row.line_discount_kind === 'percent'
                  ? '%'
                  : row.line_discount_kind === 'fixed_cents'
                    ? '$'
                    : '—'
              }
              value={row.line_discount_input}
              onChange={(e) => updateRow(row.key, { line_discount_input: e.target.value })}
              readOnly={row.line_discount_kind === 'none'}
            />
          </div>
        </div>
        <div className={styles.lineItemCardGrid}>
          <div>
            <label className={styles.label} htmlFor={`line_pricing_method_${row.key}`}>
              Pricing method
            </label>
            <select
              id={`line_pricing_method_${row.key}`}
              name="line_pricing_method"
              className={styles.select}
              value={row.pricing_method}
              onChange={(e) =>
                updateRow(row.key, {
                  pricing_method: e.target.value as QuoteLinePricingMethod,
                })
              }
            >
              {QUOTE_LINE_PRICING_METHOD_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        name="line_service"
        className={styles.input}
        list={`line_service_suggestions_${row.key}`}
        placeholder="e.g. Deep cleaning"
        value={row.service_label}
        onChange={(e) => {
          const service_label = e.target.value;
          updateRow(row.key, { service_label, ...syncCatalogMatch(service_label) });
        }}
        aria-label="Service name"
      />
      <datalist id={`line_service_suggestions_${row.key}`}>
        {serviceSuggestions.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      <input
        type="hidden"
        name="line_service_template_id"
        value={row.service_template_id}
        readOnly
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
            auto_schedule_visit_count:
              row.auto_schedule_on_accept && isRecurringQuoteLineFrequency(frequency)
                ? row.auto_schedule_visit_count || String(defaultAutoScheduleVisitCount(frequency))
                : '',
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
        placeholder={
          row.line_discount_kind === 'percent'
            ? '%'
            : row.line_discount_kind === 'fixed_cents'
              ? '$'
              : '—'
        }
        value={row.line_discount_input}
        onChange={(e) => updateRow(row.key, { line_discount_input: e.target.value })}
        readOnly={row.line_discount_kind === 'none'}
        aria-label="Line discount value"
      />
      <input
        type="hidden"
        name="line_pricing_method"
        value={row.pricing_method}
        readOnly
        aria-hidden
      />
    </>
  );
}

export function QuoteLineItemsEditor({
  initialRows,
  layout = 'grid',
  rows: controlledRows,
  onRowsChange,
  hideLegend = false,
  rowsRevision,
  jobTypeCatalog = [],
  quotePropertyKind = null,
  autoScheduleEnabled = false,
}: {
  initialRows?: QuoteLineItemRow[] | null;
  layout?: 'grid' | 'cards';
  rows?: QuoteLineItemDraft[];
  onRowsChange?: (rows: QuoteLineItemDraft[]) => void;
  hideLegend?: boolean;
  /** Bump after a successful save to reload rows from `initialRows` without remounting the parent form. */
  rowsRevision?: number;
  jobTypeCatalog?: JobTypeCatalogEntry[];
  quotePropertyKind?: CustomerPropertyKind | null;
  autoScheduleEnabled?: boolean;
}) {
  const [internalRows, setInternalRows] = useState<QuoteLineItemDraft[]>(() => {
    const fromDb = draftsFromQuoteLineRows(initialRows ?? null);
    return fromDb.length > 0 ? fromDb : [createEmptyQuoteLineDraft()];
  });

  const controlled = controlledRows !== undefined && onRowsChange !== undefined;
  const rows = controlled ? controlledRows : internalRows;

  useEffect(() => {
    if (controlled || !rowsRevision) return;
    const fromDb = draftsFromQuoteLineRows(initialRows ?? null);
    setInternalRows(fromDb.length > 0 ? fromDb : [createEmptyQuoteLineDraft()]);
  }, [rowsRevision, controlled, initialRows]);

  const setRows = useCallback(
    (updater: QuoteLineItemDraft[] | ((prev: QuoteLineItemDraft[]) => QuoteLineItemDraft[])) => {
      if (controlled) {
        const next = typeof updater === 'function' ? updater(controlledRows) : updater;
        onRowsChange(next);
      } else {
        setInternalRows(updater);
      }
    },
    [controlled, controlledRows, onRowsChange],
  );

  const updateRow = useCallback(
    (key: string, patch: Partial<QuoteLineItemDraft>) => {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    },
    [setRows],
  );

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyQuoteLineDraft()]);
  }, [setRows]);

  const removeRow = useCallback(
    (key: string) => {
      setRows((prev) => {
        if (prev.length <= 1) {
          return [createEmptyQuoteLineDraft()];
        }
        return prev.filter((r) => r.key !== key);
      });
    },
    [setRows],
  );

  return (
    <fieldset className={styles.lineItemsFieldset}>
      {!hideLegend ? (
        <>
          <legend className={styles.lineItemsLegend}>Services &amp; pricing</legend>
          <p className={styles.lineItemsIntro}>
            Add one row per priced service. Cadence describes how often that price applies. Line
            discounts reduce that row&apos;s amount before the quote subtotal. Flag lines to
            auto-schedule when the customer accepts.
          </p>
        </>
      ) : null}

      {layout === 'grid' ? (
        <>
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
              <div key={row.key} className={styles.lineItemRowGroup}>
                <div className={styles.lineItemRow}>
                  <LineItemFields
                    row={row}
                    updateRow={updateRow}
                    layout="grid"
                    catalog={jobTypeCatalog}
                    propertyKind={quotePropertyKind}
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
                <AutoScheduleFields
                  row={row}
                  updateRow={updateRow}
                  catalogDefaultHours={catalogDefaultHoursForRow(
                    row,
                    jobTypeCatalog,
                    quotePropertyKind,
                  )}
                  autoScheduleEnabled={autoScheduleEnabled}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.lineItemCards}>
          {rows.map((row) => (
            <div key={row.key} className={styles.lineItemCard}>
              <div className={styles.lineItemCardHeader}>
                <strong>{row.service_label.trim() || 'Service line'}</strong>
                <button
                  type="button"
                  className={styles.lineItemIconButton}
                  onClick={() => removeRow(row.key)}
                  aria-label="Remove service row"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
              <LineItemFields
                row={row}
                updateRow={updateRow}
                layout="cards"
                catalog={jobTypeCatalog}
                propertyKind={quotePropertyKind}
              />
              <AutoScheduleFields
                row={row}
                updateRow={updateRow}
                catalogDefaultHours={catalogDefaultHoursForRow(
                  row,
                  jobTypeCatalog,
                  quotePropertyKind,
                )}
                autoScheduleEnabled={autoScheduleEnabled}
              />
            </div>
          ))}
        </div>
      )}

      <button type="button" className={styles.lineItemAddButton} onClick={addRow}>
        <Plus size={18} aria-hidden />
        Add service
      </button>
    </fieldset>
  );
}
