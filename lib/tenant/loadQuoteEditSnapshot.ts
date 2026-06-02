import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { QuoteStatus } from '@/lib/tenant/quoteLabels';
import { quoteHeaderPricingDefaultsFromQuote } from '@/lib/tenant/quoteHeaderPricingDefaults';

export type QuoteEditLineItem = Pick<
  Database['public']['Tables']['tenant_quote_line_items']['Row'],
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

export type QuoteEditSnapshot = {
  quoteId: string;
  title: string;
  status: QuoteStatus;
  customerId: string;
  propertyId: string;
  amountCents: number | null;
  notes: string;
  validUntilYmd: string;
  lineItems: QuoteEditLineItem[];
  headerPricing: ReturnType<typeof quoteHeaderPricingDefaultsFromQuote>;
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export async function loadQuoteEditSnapshot(
  admin: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
): Promise<QuoteEditSnapshot | null> {
  const { data: row, error } = await admin
    .from('tenant_quotes')
    .select(
      `
      id,
      title,
      status,
      customer_id,
      property_id,
      amount_cents,
      notes,
      valid_until,
      tax_mode,
      tax_rate_bps,
      quote_discount_kind,
      quote_discount_value,
      tenant_quote_line_items (
        id,
        sort_order,
        service_label,
        frequency,
        frequency_detail,
        amount_cents,
        line_discount_kind,
        line_discount_value,
        pricing_method,
        estimated_hours,
        auto_schedule_on_accept,
        auto_schedule_visit_count,
        service_template_id
      )
    `,
    )
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !row) return null;

  const lineItems = [...(row.tenant_quote_line_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return {
    quoteId: row.id,
    title: row.title,
    status: row.status as QuoteStatus,
    customerId: row.customer_id ?? '',
    propertyId: row.property_id ?? '',
    amountCents: row.amount_cents,
    notes: row.notes ?? '',
    validUntilYmd: toDateInputValue(row.valid_until),
    lineItems,
    headerPricing: quoteHeaderPricingDefaultsFromQuote(row),
  };
}
