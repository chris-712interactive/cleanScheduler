import { describe, expect, it } from 'vitest';
import { parseQuoteLineItemsFromForm } from '@/lib/tenant/quoteLineItemsForm';

function lineForm(overrides: Record<string, string> = {}): FormData {
  const fields: Record<string, string> = {
    line_service: 'Nightly office clean',
    line_frequency: 'weekly',
    line_frequency_detail: '',
    line_amount: '',
    line_discount_kind: 'none',
    line_discount_input: '',
    line_pricing_method: 'per_sqft',
    line_estimated_hours: '',
    line_auto_schedule: '',
    line_auto_schedule_visit_count: '',
    line_service_template_id: '',
    line_display_title: '',
    line_sqft_rate: '0.10',
    line_billable_sqft: '',
    line_times_per_week: '',
    line_times_per_month: '',
    line_production_sqft_per_hour: '',
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe('parseQuoteLineItemsFromForm square-foot lines', () => {
  it('rejects per-sq-ft pricing on a residential property', () => {
    const parsed = parseQuoteLineItemsFromForm(lineForm({ line_billable_sqft: '1000' }), {
      allowPerSqft: true,
      propertyKind: 'residential',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/commercial properties/i);
  });

  it('rejects a fractional line square footage instead of using the property size', () => {
    const parsed = parseQuoteLineItemsFromForm(lineForm({ line_billable_sqft: '1000.5' }), {
      allowPerSqft: true,
      propertyKind: 'commercial',
      defaultSqft: 12000,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/whole number/i);
  });

  it('rejects zero instead of falling back to the property size', () => {
    const parsed = parseQuoteLineItemsFromForm(lineForm({ line_billable_sqft: '0' }), {
      allowPerSqft: true,
      propertyKind: 'commercial',
      defaultSqft: 12000,
    });
    expect(parsed.ok).toBe(false);
  });

  it('uses the property square footage when the line leaves it blank', () => {
    const parsed = parseQuoteLineItemsFromForm(lineForm(), {
      allowPerSqft: true,
      propertyKind: 'commercial',
      defaultSqft: 1000,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lines[0]?.billable_sqft).toBe(1000);
    expect(parsed.lines[0]?.amount_cents).toBe(Math.round(10_000 * 4.333));
  });
});
