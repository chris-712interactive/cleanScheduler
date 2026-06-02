import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { parseQuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import type { Database } from '@/lib/supabase/database.types';
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

export type QuoteLineDiscountKind = Database['public']['Enums']['quote_line_discount_kind'];
export type QuoteLinePricingMethod = Database['public']['Enums']['quote_line_pricing_method'];

export interface ParsedQuoteLineItem {
  sort_order: number;
  service_label: string;
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
}

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

/**
 * Reads parallel `line_*` fields from FormData (see QuoteLineItemsEditor).
 * Drops completely blank rows. Validates non-empty lines.
 */
export function parseQuoteLineItemsFromForm(
  formData: FormData,
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

    const rowBlank =
      !service_label && !amountRaw.trim() && line_discount_kind === 'none' && !discInputRaw.trim();
    if (rowBlank) continue;

    if (!service_label) {
      return { ok: false, error: 'Each service line needs a service name / type.' };
    }

    if (frequency === 'custom' && !frequency_detail_raw) {
      return {
        ok: false,
        error: 'Custom cadence lines need a short description (e.g. "Every other Thursday").',
      };
    }

    const parsed = parseDollarsToCents(amountRaw);
    if (!parsed.ok) return parsed;

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

    let estimated_hours: number | null = null;
    if (hoursRaw) {
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
      service_label,
      frequency,
      frequency_detail: frequency_detail_raw ? frequency_detail_raw : null,
      amount_cents: parsed.cents,
      line_discount_kind,
      line_discount_value,
      pricing_method,
      estimated_hours,
      auto_schedule_on_accept,
      auto_schedule_visit_count,
      service_template_id: (serviceTemplateIds[i] ?? '').trim() || null,
    });
  }

  return { ok: true, lines };
}
