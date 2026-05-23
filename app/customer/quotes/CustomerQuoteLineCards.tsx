import { QUOTE_LINE_FREQUENCY_LABEL } from '@/lib/tenant/quoteLineFrequency';
import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { formatQuoteLineDiscountShort, formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { effectiveLineSubtotalCents } from '@/lib/tenant/quoteTotals';
import type { Database } from '@/lib/supabase/database.types';
import styles from './quotes.module.scss';

type QuoteLineDiscountKind = Database['public']['Enums']['quote_line_discount_kind'];

export type CustomerQuoteLineView = {
  key: string;
  service_label: string;
  frequency: QuoteLineFrequency;
  frequency_detail: string | null;
  amount_cents: number;
  line_discount_kind: QuoteLineDiscountKind;
  line_discount_value: number;
};

function lineCadenceLabel(line: CustomerQuoteLineView): string {
  const parts = [QUOTE_LINE_FREQUENCY_LABEL[line.frequency]];
  const detail = line.frequency_detail?.trim();
  if (detail) parts.push(detail);
  return parts.join(' · ');
}

function lineHasDiscount(line: CustomerQuoteLineView): boolean {
  return line.line_discount_kind !== 'none' && line.line_discount_value > 0;
}

export function CustomerQuoteLineCards({
  lines,
  currency,
}: {
  lines: CustomerQuoteLineView[];
  currency: string;
}) {
  if (lines.length === 0) {
    return (
      <p className={styles.muted}>No service lines on this quote yet.</p>
    );
  }

  const anyDiscount = lines.some(lineHasDiscount);

  return (
    <ul className={styles.lineCardList}>
      {lines.map((line) => {
        const discounted = lineHasDiscount(line);
        const yourPrice = effectiveLineSubtotalCents({
          amount_cents: line.amount_cents,
          line_discount_kind: line.line_discount_kind,
          line_discount_value: line.line_discount_value,
        });

        return (
          <li key={line.key} className={styles.lineCard}>
            <div className={styles.lineCardMain}>
              <p className={styles.lineCardLabel}>{line.service_label}</p>
              <p className={styles.lineCardCadence}>{lineCadenceLabel(line)}</p>
              {discounted && anyDiscount ? (
                <p className={styles.lineCardDiscount}>
                  List {formatQuoteMoney(line.amount_cents, currency)}
                  {' · '}
                  {formatQuoteLineDiscountShort(
                    line.line_discount_kind,
                    line.line_discount_value,
                    currency,
                  )}{' '}
                  off
                </p>
              ) : null}
            </div>
            <p className={styles.lineCardPrice}>{formatQuoteMoney(yourPrice, currency)}</p>
          </li>
        );
      })}
    </ul>
  );
}
