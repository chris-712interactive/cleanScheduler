'use client';

import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteHeaderPricingDefaults } from '@/lib/tenant/quoteHeaderPricingDefaults';
import styles from './quotes.module.scss';

export type { QuoteHeaderPricingDefaults } from '@/lib/tenant/quoteHeaderPricingDefaults';

type QuoteTaxMode = Tables<'tenant_quotes'>['tax_mode'];
type QuoteDiscountKind = Tables<'tenant_quotes'>['quote_discount_kind'];

const TAX_OPTIONS: { value: QuoteTaxMode; label: string }[] = [
  { value: 'none', label: 'No tax' },
  { value: 'exclusive', label: 'Add tax on top (exclusive)' },
];

const DISC_OPTIONS: { value: QuoteDiscountKind; label: string }[] = [
  { value: 'none', label: 'No quote-level discount' },
  { value: 'percent', label: 'Percent off subtotal' },
  { value: 'fixed_cents', label: 'Fixed amount off subtotal' },
];

export function QuoteHeaderPricingFields({
  defaults,
}: {
  /** When omitted, fields start empty / defaults for selects. */
  defaults?: QuoteHeaderPricingDefaults | null;
}) {
  const taxMode = defaults?.taxMode ?? 'none';
  const discKind = defaults?.quoteDiscountKind ?? 'none';

  return (
    <>
      <fieldset className={styles.pricingBlock}>
        <legend className={styles.pricingLegend}>Tax</legend>
        <label className={styles.label} htmlFor="quote_tax_mode">
          How tax applies
        </label>
        <select
          id="quote_tax_mode"
          name="quote_tax_mode"
          className={styles.select}
          defaultValue={taxMode}
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
        <p className={styles.hint}>
          Used only when tax is set to add on top. Example: 8.875 for 8.875%.
        </p>
        <input
          id="quote_tax_rate_percent"
          name="quote_tax_rate_percent"
          className={styles.input}
          inputMode="decimal"
          placeholder="0"
          defaultValue={defaults?.taxRatePercent ?? ''}
        />
      </fieldset>

      <fieldset className={styles.pricingBlock}>
        <legend className={styles.pricingLegend}>Quote-level discount</legend>
        <label className={styles.label} htmlFor="quote_discount_kind">
          Discount type
        </label>
        <select
          id="quote_discount_kind"
          name="quote_discount_kind"
          className={styles.select}
          defaultValue={discKind}
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
        <p className={styles.hint}>Used when discount type is percent (for example 10 for 10%).</p>
        <input
          id="quote_discount_percent"
          name="quote_discount_percent"
          className={styles.input}
          inputMode="decimal"
          placeholder="0"
          defaultValue={defaults?.quoteDiscountPercent ?? ''}
        />
        <label className={styles.label} htmlFor="quote_discount_dollars">
          Discount ($)
        </label>
        <p className={styles.hint}>Used when discount type is a fixed amount.</p>
        <input
          id="quote_discount_dollars"
          name="quote_discount_dollars"
          className={styles.input}
          inputMode="decimal"
          placeholder="0.00"
          defaultValue={defaults?.quoteDiscountDollars ?? ''}
        />
      </fieldset>
    </>
  );
}
