import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { parseQuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import type { Database } from '@/lib/supabase/database.types';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import {
  parseDiscountDollarsToCents,
  parseDiscountPercentToBps,
  parseQuoteLineDiscountKind,
} from '@/lib/tenant/quoteHeaderPricingForm';
import { parseQuoteLinePricingMethod } from '@/lib/tenant/quoteLinePricingMethod';
import {
  isRecurringQuoteLineFrequency,
  parseAutoScheduleFlag,
  parseAutoScheduleVisitCount,
} from '@/lib/tenant/quoteLineAutoSchedule';
import { computeSqftBid, type SqftBidPeriod } from '@/lib/tenant/sqftBid';

export type QuoteLineDiscountKind = Database['public']['Enums']['quote_line_discount_kind'];
export type QuoteLinePricingMethod = Database['public']['Enums']['quote_line_pricing_method'];

export interface ParsedQuoteLineItem {
  sort_order: number;
  service_label: string;
  display_title: string | null;
  frequency: QuoteLineFrequency;
  frequency_detail: string | null;
  amount_cents: number;
  line_discount_kind: QuoteLineDiscountKind;
  line_discount_value: number;
  pricing_method: QuoteLinePricingMethod;
  estimated_hours: number | null;
  auto_schedule_on_accept: boolean;
  auto_schedule_visit_count: number | null;
  service_template_id: string | null;
  sqft_rate_cents: number | null;
  billable_sqft: number | null;
  bid_visits: number | null;
  bid_period: SqftBidPeriod;
  production_sqft_per_hour: number | null;
}

export type QuoteLineParseOptions = {
  /** When false, a per_sqft line is rejected. Commercial segments pass true. */
  allowPerSqft?: boolean;
  /** Property the quote is pricing. Square-foot bids require commercial. */
  propertyKind?: CustomerPropertyKind | null;
  /** Property square footage used when a line does not override it. */
  defaultSqft?: number | null;
};

function parseDollarsToCents(
  raw: string,
): { ok: true; cents: number } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: false, error: 'Each service line needs an amount.' };
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0)
    return { ok: false, error: 'Enter a valid amount for each service line.' };
  const cents = Math.round(n * 100);
  if (!Number.isSafeInteger(cents))
    return { ok: false, error: 'Amount too large on a service line.' };
  return { ok: true, cents };
}

function parseOptionalCount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function emptyBidFields(): Pick<
  ParsedQuoteLineItem,
  'sqft_rate_cents' | 'billable_sqft' | 'bid_visits' | 'bid_period' | 'production_sqft_per_hour'
> {
  return {
    sqft_rate_cents: null,
    billable_sqft: null,
    bid_visits: null,
    bid_period: 'visit',
    production_sqft_per_hour: null,
  };
}

/**
 * Reads parallel `line_*` fields from FormData (see QuoteLineItemsEditor).
 * Drops completely blank rows. Validates non-empty lines.
 * `per_sqft` lines ignore the typed dollar amount and recompute it from rate × sqft × visits.
 */
export function parseQuoteLineItemsFromForm(
  formData: FormData,
  options: QuoteLineParseOptions = {},
): { ok: true; lines: ParsedQuoteLineItem[] } | { ok: false; error: string } {
  const services = formData.getAll('line_service').map((v) => String(v));
  const frequencies = formData.getAll('line_frequency').map((v) => String(v));
  const details = formData.getAll('line_frequency_detail').map((v) => String(v));
  const amounts = formData.getAll('line_amount').map((v) => String(v));
  const discKinds = formData.getAll('line_discount_kind').map((v) => String(v));
  const discInputs = formData.getAll('line_discount_input').map((v) => String(v));
  const pricingMethods = formData.getAll('line_pricing_method').map((v) => String(v));
  const estimatedHours = formData.getAll('line_estimated_hours').map((v) => String(v));
  const autoScheduleFlags = formData.getAll('line_auto_schedule').map((v) => String(v));
  const autoScheduleVisitCounts = formData
    .getAll('line_auto_schedule_visit_count')
    .map((v) => String(v));
  const serviceTemplateIds = formData.getAll('line_service_template_id').map((v) => String(v));
  const displayTitles = formData.getAll('line_display_title').map((v) => String(v));
  const sqftRates = formData.getAll('line_sqft_rate').map((v) => String(v));
  const billableSqfts = formData.getAll('line_billable_sqft').map((v) => String(v));
  const timesPerWeek = formData.getAll('line_times_per_week').map((v) => String(v));
  const timesPerMonth = formData.getAll('line_times_per_month').map((v) => String(v));
  const productionRates = formData.getAll('line_production_sqft_per_hour').map((v) => String(v));

  const n = Math.max(
    services.length,
    frequencies.length,
    details.length,
    amounts.length,
    discKinds.length,
    discInputs.length,
    pricingMethods.length,
    estimatedHours.length,
    autoScheduleFlags.length,
    autoScheduleVisitCounts.length,
    serviceTemplateIds.length,
    displayTitles.length,
    sqftRates.length,
    billableSqfts.length,
  );
  const lines: ParsedQuoteLineItem[] = [];

  for (let i = 0; i < n; i++) {
    const service_label = (services[i] ?? '').trim();
    const frequency = parseQuoteLineFrequency(frequencies[i] ?? '');
    const frequency_detail_raw = (details[i] ?? '').trim();
    const amountRaw = amounts[i] ?? '';
    const line_discount_kind = parseQuoteLineDiscountKind(discKinds[i] ?? '');
    const discInputRaw = discInputs[i] ?? '';
    const pricing_method = parseQuoteLinePricingMethod(pricingMethods[i] ?? 'flat');
    const hoursRaw = (estimatedHours[i] ?? '').trim();
    const auto_schedule_on_accept = parseAutoScheduleFlag(autoScheduleFlags[i] ?? '');
    const frequencyForCount = frequency;

    const service_template_id = (serviceTemplateIds[i] ?? '').trim() || null;
    const display_title = (displayTitles[i] ?? '').trim() || null;

    const rateRaw = sqftRates[i] ?? '';
    const sqftRaw = billableSqfts[i] ?? '';
    const rowBlank =
      !service_label &&
      !service_template_id &&
      !amountRaw.trim() &&
      !rateRaw.trim() &&
      line_discount_kind === 'none' &&
      !discInputRaw.trim();
    if (rowBlank) continue;

    if (!service_template_id && !service_label) {
      return { ok: false, error: 'Select a job type for each service line.' };
    }

    if (frequency === 'custom' && !frequency_detail_raw) {
      return {
        ok: false,
        error: 'Custom cadence lines need a short description (e.g. "Every other Thursday").',
      };
    }

    let amount_cents = 0;
    let bid = emptyBidFields();
    let estimatedFromBid: number | null = null;
    if (pricing_method === 'per_sqft') {
      if (!options.allowPerSqft) {
        return {
          ok: false,
          error: 'Square-foot bids are only available for commercial cleaning workspaces.',
        };
      }
      if (options.propertyKind !== 'commercial') {
        return { ok: false, error: 'Square-foot bids are only for commercial properties.' };
      }
      const rateParsed = parseDollarsToCents(rateRaw || '0');
      if (!rateRaw.trim()) {
        return { ok: false, error: 'Enter a rate per square foot for each square-foot line.' };
      }
      if (!rateParsed.ok) return { ok: false, error: 'Enter a valid rate per square foot.' };
      const sqftInput = parseOptionalCount(sqftRaw);
      const sqft =
        sqftInput != null && Number.isInteger(sqftInput)
          ? sqftInput
          : options.defaultSqft != null && Number.isInteger(options.defaultSqft)
            ? options.defaultSqft
            : null;
      const production = parseOptionalCount(productionRates[i] ?? '');
      const computed = computeSqftBid({
        rateCentsPerSqft: rateParsed.cents,
        sqft: sqft ?? 0,
        frequency,
        timesPerWeek: parseOptionalCount(timesPerWeek[i] ?? ''),
        timesPerMonth: parseOptionalCount(timesPerMonth[i] ?? ''),
        productionSqftPerHour: production,
      });
      if (!computed.ok) return computed;
      amount_cents = computed.breakdown.amountCents;
      estimatedFromBid = computed.breakdown.estimatedHoursPerVisit;
      bid = {
        sqft_rate_cents: computed.breakdown.rateCentsPerSqft,
        billable_sqft: computed.breakdown.billableSqft,
        bid_visits: computed.breakdown.visitsInPeriod,
        bid_period: computed.breakdown.period,
        production_sqft_per_hour: computed.breakdown.productionSqftPerHour,
      };
    } else {
      const parsed = parseDollarsToCents(amountRaw);
      if (!parsed.ok) return parsed;
      amount_cents = parsed.cents;
    }

    let line_discount_value = 0;
    if (line_discount_kind === 'percent') {
      const p = parseDiscountPercentToBps(discInputRaw);
      if (!p.ok) return { ok: false, error: p.error };
      line_discount_value = p.bps;
    } else if (line_discount_kind === 'fixed_cents') {
      const d = parseDiscountDollarsToCents(discInputRaw);
      if (!d.ok) return { ok: false, error: d.error };
      line_discount_value = d.cents;
    }

    let estimated_hours: number | null = estimatedFromBid;
    if (estimated_hours == null && hoursRaw) {
      const h = Number(hoursRaw.replace(/,/g, ''));
      if (!Number.isFinite(h) || h < 0) {
        return { ok: false, error: 'Enter a valid estimated hours value on each service line.' };
      }
      estimated_hours = Math.round(h * 100) / 100;
    }

    let auto_schedule_visit_count: number | null = null;
    if (auto_schedule_on_accept) {
      if (isRecurringQuoteLineFrequency(frequencyForCount)) {
        auto_schedule_visit_count = parseAutoScheduleVisitCount(
          autoScheduleVisitCounts[i] ?? '',
          frequencyForCount,
        );
      } else {
        auto_schedule_visit_count = 1;
      }
    }

    lines.push({
      sort_order: lines.length,
      service_label: service_label || 'Pending',
      display_title,
      frequency,
      frequency_detail: frequency_detail_raw ? frequency_detail_raw : null,
      amount_cents,
      line_discount_kind,
      line_discount_value,
      pricing_method,
      estimated_hours,
      auto_schedule_on_accept,
      auto_schedule_visit_count,
      service_template_id: (serviceTemplateIds[i] ?? '').trim() || null,
      ...bid,
    });
  }

  return { ok: true, lines };
}
