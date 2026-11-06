import { describe, expect, it } from 'vitest';
import {
  breakdownFromStoredSqftBid,
  computeSqftBid,
  resolveBillableSqft,
  roundVisitCount,
  sqftBidSummaryLines,
  WEEKS_PER_MONTH,
} from '@/lib/tenant/sqftBid';

describe('computeSqftBid', () => {
  it('prices one visit as rate times square feet', () => {
    const result = computeSqftBid({
      rateCentsPerSqft: 15,
      sqft: 2500,
      frequency: 'one_time',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.breakdown.visitAmountCents).toBe(37_500);
    expect(result.breakdown.amountCents).toBe(37_500);
    expect(result.breakdown.period).toBe('visit');
    expect(result.breakdown.estimatedHoursPerVisit).toBeNull();
  });

  it('turns a weekly cadence into a monthly contract using 52/12', () => {
    const result = computeSqftBid({
      rateCentsPerSqft: 10,
      sqft: 1000,
      frequency: 'weekly',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.breakdown.visitsInPeriod).toBe(Math.round(WEEKS_PER_MONTH * 1000) / 1000);
    expect(result.breakdown.period).toBe('month');
    expect(result.breakdown.amountCents).toBe(
      Math.round(10_000 * roundVisitCount(WEEKS_PER_MONTH)),
    );
    expect(result.breakdown.visitAmountCents).toBe(10_000);
  });

  it('uses an explicit times-per-week override for a custom cadence', () => {
    const result = computeSqftBid({
      rateCentsPerSqft: 8,
      sqft: 5000,
      frequency: 'custom',
      timesPerWeek: 3,
      productionSqftPerHour: 2000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.breakdown.visitsInPeriod).toBe(Math.round(3 * WEEKS_PER_MONTH * 1000) / 1000);
    expect(result.breakdown.amountCents).toBe(
      Math.round(8 * 5000 * roundVisitCount(3 * WEEKS_PER_MONTH)),
    );
    expect(result.breakdown.estimatedHoursPerVisit).toBe(2.5);
    expect(result.breakdown.productionSqftPerHour).toBe(2000);
  });

  it('uses times per month when that is the contract cadence', () => {
    const result = computeSqftBid({
      rateCentsPerSqft: 12,
      sqft: 800,
      frequency: 'monthly',
      timesPerMonth: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.breakdown.amountCents).toBe(12 * 800 * 2);
    expect(result.breakdown.period).toBe('month');
  });

  it('requires square footage and a custom frequency count', () => {
    expect(computeSqftBid({ rateCentsPerSqft: 10, sqft: 0, frequency: 'one_time' }).ok).toBe(false);
    const custom = computeSqftBid({
      rateCentsPerSqft: 10,
      sqft: 100,
      frequency: 'custom',
    });
    expect(custom.ok).toBe(false);
    if (custom.ok) return;
    expect(custom.error).toMatch(/times per week/i);
  });
});

describe('stored visit count matches the charge', () => {
  it('multiplies the displayed weekly visit count by the per-visit price', () => {
    const result = computeSqftBid({
      rateCentsPerSqft: 25,
      sqft: 50_000,
      frequency: 'weekly',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.breakdown.visitsInPeriod).toBe(4.333);
    expect(result.breakdown.visitAmountCents).toBe(1_250_000);
    expect(result.breakdown.amountCents).toBe(
      Math.round(result.breakdown.visitAmountCents * result.breakdown.visitsInPeriod),
    );
    const lines = sqftBidSummaryLines(result.breakdown);
    expect(lines[1]).toContain('4.333 visits / month');
    expect(lines[1]).toContain('$54,162.50');
  });
});

describe('resolveBillableSqft', () => {
  it('uses the property size only when the line is blank', () => {
    expect(resolveBillableSqft('', 12000)).toEqual({ ok: true, sqft: 12000 });
  });

  it('rejects zero and fractional line values instead of falling back', () => {
    expect(resolveBillableSqft('0', 12000).ok).toBe(false);
    expect(resolveBillableSqft('1000.5', 12000).ok).toBe(false);
  });
});

describe('sqft bid explanation', () => {
  it('lists the rate, monthly visits, and labor estimate', () => {
    const result = computeSqftBid({
      rateCentsPerSqft: 10,
      sqft: 1000,
      frequency: 'weekly',
      productionSqftPerHour: 500,
    });
    if (!result.ok) throw new Error('expected bid');
    const lines = sqftBidSummaryLines(result.breakdown);
    expect(lines[0]).toContain('$0.10 / sq ft');
    expect(lines[0]).toContain('1,000 sq ft');
    expect(lines[1]).toContain('monthly contract');
    expect(lines[2]).toContain('2 labor hours');
  });

  it('rebuilds a stored commercial line', () => {
    const stored = breakdownFromStoredSqftBid({
      pricing_method: 'per_sqft',
      amount_cents: 43_333,
      sqft_rate_cents: 10,
      billable_sqft: 1000,
      bid_visits: WEEKS_PER_MONTH,
      bid_period: 'month',
      production_sqft_per_hour: null,
      estimated_hours: null,
    });
    expect(stored?.period).toBe('month');
    expect(stored?.visitAmountCents).toBe(10_000);
    expect(breakdownFromStoredSqftBid({ pricing_method: 'flat', amount_cents: 100 })).toBeNull();
  });
});
