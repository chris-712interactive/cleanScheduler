import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { computeQuoteTotals } from '@/lib/tenant/quoteTotals';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface SalesTaxJurisdictionRow {
  jurisdictionKey: string;
  state: string;
  quoteCount: number;
  taxableCents: number;
  taxCents: number;
}

export interface SalesTaxSummaryResult {
  rows: SalesTaxJurisdictionRow[];
  missingPropertyCount: number;
  summary: ReportSummaryLine[];
}

function jurisdictionKey(state: string | null, postalCode: string | null): string {
  const st = (state ?? '').trim().toUpperCase() || '—';
  const zip = (postalCode ?? '').trim().slice(0, 5);
  return zip ? `${st} ${zip}` : st;
}

export async function runSalesTaxSummaryReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<SalesTaxSummaryResult> {
  let quoteQuery = db
    .from('tenant_quotes')
    .select(
      `
      id,
      tax_mode,
      tax_rate_bps,
      quote_discount_kind,
      quote_discount_value,
      amount_cents,
      property_id,
      tenant_customer_properties (
        state,
        postal_code
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'accepted')
    .is('superseded_by_quote_id', null);

  if (fromIso) quoteQuery = quoteQuery.gte('accepted_at', fromIso);
  if (toIso) quoteQuery = quoteQuery.lte('accepted_at', toIso);

  const { data: quotes, error } = await quoteQuery;
  if (error || !quotes?.length) {
    return {
      rows: [],
      missingPropertyCount: 0,
      summary: [
        { label: 'Tax collected (est.)', value: '$0.00' },
        { label: 'Note', value: 'Based on accepted quote tax settings' },
      ],
    };
  }

  const quoteIds = quotes.map((q) => q.id);
  const { data: lines } = await db
    .from('tenant_quote_line_items')
    .select('quote_id, amount_cents, line_discount_kind, line_discount_value')
    .eq('tenant_id', tenantId)
    .in('quote_id', quoteIds);

  const linesByQuote = new Map<string, typeof lines>();
  for (const line of lines ?? []) {
    const list = linesByQuote.get(line.quote_id) ?? [];
    list.push(line);
    linesByQuote.set(line.quote_id, list);
  }

  const map = new Map<string, SalesTaxJurisdictionRow>();
  let missingPropertyCount = 0;
  let totalTax = 0;

  for (const quote of quotes) {
    const property = quote.tenant_customer_properties;
    if (!property?.state) {
      missingPropertyCount += 1;
    }

    const key = jurisdictionKey(property?.state ?? null, property?.postal_code ?? null);
    const quoteLines = linesByQuote.get(quote.id) ?? [];
    const totals = computeQuoteTotals({
      lines: quoteLines,
      header_subtotal_cents: quoteLines.length === 0 ? quote.amount_cents : null,
      tax_mode: quote.tax_mode,
      tax_rate_bps: quote.tax_rate_bps,
      quote_discount_kind: quote.quote_discount_kind,
      quote_discount_value: quote.quote_discount_value,
    });

    const prev = map.get(key) ?? {
      jurisdictionKey: key,
      state: (property?.state ?? 'Unknown').toUpperCase(),
      quoteCount: 0,
      taxableCents: 0,
      taxCents: 0,
    };
    prev.quoteCount += 1;
    prev.taxableCents += totals.after_quote_discount;
    prev.taxCents += totals.tax_cents;
    map.set(key, prev);
    totalTax += totals.tax_cents;
  }

  const rows = [...map.values()].sort((a, b) => b.taxCents - a.taxCents);

  return {
    rows,
    missingPropertyCount,
    summary: [
      { label: 'Tax collected (est.)', value: formatUsdFromCents(totalTax) },
      { label: 'Jurisdictions', value: String(rows.length) },
      {
        label: 'Missing property',
        value: missingPropertyCount > 0 ? String(missingPropertyCount) : 'None',
      },
    ],
  };
}
