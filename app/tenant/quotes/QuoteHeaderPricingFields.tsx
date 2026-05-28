'use client';

import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteHeaderPricingDefaults } from '@/lib/tenant/quoteHeaderPricingDefaults';
import styles from './quotes.module.scss';

export type { QuoteHeaderPricingDefaults } from '@/lib/tenant/quoteHeaderPricingDefaults';

type QuoteTaxMode = Tables<'tenant_quotes'>['tax_mode'];
type QuoteDiscountKind = Tables<'tenant_quotes'>['quote_discount_kind'];

export type QuoteHeaderPricingValues = {
  taxMode: QuoteTaxMode;
  taxRatePercent: string;
  quoteDiscountKind: QuoteDiscountKind;
  quoteDiscountPercent: string;
  quoteDiscountDollars: string;
};

const TAX_OPTIONS: { value: QuoteTaxMode; label: string }[] = [
  { value: 'none', label: 'No tax' },
  { value: 'exclusive', label: 'Add tax on top (exclusive)' },
];

const DISC_OPTIONS: { value: QuoteDiscountKind; label: string }[] = [
  { value: 'none', label: 'No quote-level discount' },
  { value: 'percent', label: 'Percent off subtotal' },
  { value: 'fixed_cents', label: 'Fixed amount off subtotal' },
];

export function defaultQuoteHeaderPricingValues(
  defaults?: QuoteHeaderPricingDefaults | null,
): QuoteHeaderPricingValues {
  return {
    taxMode: defaults?.taxMode ?? 'none',
    taxRatePercent: defaults?.taxRatePercent ?? '',
    quoteDiscountKind: defaults?.quoteDiscountKind ?? 'none',
    quoteDiscountPercent: defaults?.quoteDiscountPercent ?? '',
    quoteDiscountDollars: defaults?.quoteDiscountDollars ?? '',
  };
}

export function QuoteHeaderPricingFields({
  defaults,
  values,
  onValuesChange,
  compact = false,
}: {
  defaults?: QuoteHeaderPricingDefaults | null;
  values?: QuoteHeaderPricingValues;
  onValuesChange?: (patch: Partial<QuoteHeaderPricingValues>) => void;
  /** Hides fieldset legends for wizard pricing step. */
  compact?: boolean;
}) {
  const taxMode = values?.taxMode ?? defaults?.taxMode ?? 'none';
  const discKind = values?.quoteDiscountKind ?? defaults?.quoteDiscountKind ?? 'none';
  const controlled = values !== undefined && onValuesChange !== undefined;

  const taxRatePercent = values?.taxRatePercent ?? defaults?.taxRatePercent ?? '';
  const quoteDiscountPercent = values?.quoteDiscountPercent ?? defaults?.quoteDiscountPercent ?? '';
  const quoteDiscountDollars = values?.quoteDiscountDollars ?? defaults?.quoteDiscountDollars ?? '';

  return (
    <>
      <fieldset className={styles.pricingBlock}>
        {!compact ? <legend className={styles.pricingLegend}>Tax</legend> : null}
        <label className={styles.label} htmlFor="quote_tax_mode">
          How tax applies
        </label>
        <select
          id="quote_tax_mode"
          name="quote_tax_mode"
          className={styles.select}
          value={controlled ? taxMode : undefined}
          defaultValue={controlled ? undefined : taxMode}
          onChange={
            controlled
              ? (e) =>
                  onValuesChange({
                    taxMode: e.target.value as QuoteTaxMode,
                  })
              : undefined
          }
        >
          {TAX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className={styles.label} htmlFor="quote_tax_rate_percent">
          Tax rate (%)
        </label>
        {!compact ? (
          <p className={styles.hint}>
            Used only when tax is set to add on top. Example: 8.875 for 8.875%.
          </p>
        ) : null}
        <input
          id="quote_tax_rate_percent"
          name="quote_tax_rate_percent"
          className={styles.input}
          inputMode="decimal"
          placeholder="0"
          value={controlled ? taxRatePercent : undefined}
          defaultValue={controlled ? undefined : taxRatePercent}
          onChange={
            controlled ? (e) => onValuesChange({ taxRatePercent: e.target.value }) : undefined
          }
        />
      </fieldset>

      <fieldset className={styles.pricingBlock}>
        {!compact ? <legend className={styles.pricingLegend}>Quote-level discount</legend> : null}
        <label className={styles.label} htmlFor="quote_discount_kind">
          Discount type
        </label>
        <select
          id="quote_discount_kind"
          name="quote_discount_kind"
          className={styles.select}
          value={controlled ? discKind : undefined}
          defaultValue={controlled ? undefined : discKind}
          onChange={
            controlled
              ? (e) =>
                  onValuesChange({
                    quoteDiscountKind: e.target.value as QuoteDiscountKind,
                  })
              : undefined
          }
        >
          {DISC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className={styles.label} htmlFor="quote_discount_percent">
          Discount (%)
        </label>
        {!compact ? (
          <p className={styles.hint}>
            Used when discount type is percent (for example 10 for 10%).
          </p>
        ) : null}
        <input
          id="quote_discount_percent"
          name="quote_discount_percent"
          className={styles.input}
          inputMode="decimal"
          placeholder="0"
          value={controlled ? quoteDiscountPercent : undefined}
          defaultValue={controlled ? undefined : quoteDiscountPercent}
          onChange={
            controlled ? (e) => onValuesChange({ quoteDiscountPercent: e.target.value }) : undefined
          }
        />
        <label className={styles.label} htmlFor="quote_discount_dollars">
          Discount ($)
        </label>
        {!compact ? (
          <p className={styles.hint}>Used when discount type is a fixed amount.</p>
        ) : null}
        <input
          id="quote_discount_dollars"
          name="quote_discount_dollars"
          className={styles.input}
          inputMode="decimal"
          placeholder="0.00"
          value={controlled ? quoteDiscountDollars : undefined}
          defaultValue={controlled ? undefined : quoteDiscountDollars}
          onChange={
            controlled ? (e) => onValuesChange({ quoteDiscountDollars: e.target.value }) : undefined
          }
        />
      </fieldset>
    </>
  );
}
