import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';

/** Weeks in a month used to turn a weekly cadence into a monthly contract price (52/12). */
export const WEEKS_PER_MONTH = 52 / 12;

/** Visit counts are stored to 3 decimals. The contract total uses this same rounded count. */
export function roundVisitCount(visits: number): number {
  return Math.round(visits * 1000) / 1000;
}

export type SqftBidPeriod = 'visit' | 'month';

export type SqftBidInput = {
  /** Integer cents charged for each square foot, per visit. */
  rateCentsPerSqft: number;
  /** Cleanable square feet. Must be a positive integer. */
  sqft: number;
  frequency: QuoteLineFrequency;
  /** Explicit visit count for the priced period. Wins over the cadence default. */
  visitsPerPeriod?: number | null;
  /** Optional override: cleans per week. Monthly price uses this × 52/12. */
  timesPerWeek?: number | null;
  /** Optional override: cleans per month. */
  timesPerMonth?: number | null;
  /** Optional production rate. Labor hours = sqft / this value, per visit. */
  productionSqftPerHour?: number | null;
};

export type SqftBidBreakdown = {
  rateCentsPerSqft: number;
  billableSqft: number;
  visitAmountCents: number;
  visitsInPeriod: number;
  period: SqftBidPeriod;
  /** Line list price: one visit, or the monthly contract when the cadence repeats. */
  amountCents: number;
  estimatedHoursPerVisit: number | null;
  productionSqftPerHour: number | null;
};

export type SqftBidResult =
  { ok: true; breakdown: SqftBidBreakdown } | { ok: false; error: string };

function finiteNonNegative(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function resolveVisits(
  input: SqftBidInput,
): { ok: true; visits: number; period: SqftBidPeriod } | { ok: false; error: string } {
  const explicit = finiteNonNegative(input.visitsPerPeriod);
  if (explicit != null && explicit > 0) {
    return {
      ok: true,
      visits: explicit,
      period: input.frequency === 'one_time' ? 'visit' : 'month',
    };
  }

  const perMonth = finiteNonNegative(input.timesPerMonth);
  if (perMonth != null && perMonth > 0) {
    return { ok: true, visits: perMonth, period: 'month' };
  }

  const perWeek = finiteNonNegative(input.timesPerWeek);
  if (perWeek != null && perWeek > 0) {
    return { ok: true, visits: perWeek * WEEKS_PER_MONTH, period: 'month' };
  }

  switch (input.frequency) {
    case 'one_time':
      return { ok: true, visits: 1, period: 'visit' };
    case 'weekly':
      return { ok: true, visits: WEEKS_PER_MONTH, period: 'month' };
    case 'biweekly':
      return { ok: true, visits: WEEKS_PER_MONTH / 2, period: 'month' };
    case 'monthly':
      return { ok: true, visits: 1, period: 'month' };
    case 'custom':
      return {
        ok: false,
        error: 'Custom square-foot bids need times per week or times per month.',
      };
    default:
      return { ok: true, visits: 1, period: 'visit' };
  }
}

/** Price a commercial clean from a per-square-foot rate, the site size, and how often it repeats. */
export function computeSqftBid(input: SqftBidInput): SqftBidResult {
  if (!Number.isFinite(input.rateCentsPerSqft) || input.rateCentsPerSqft < 0) {
    return { ok: false, error: 'Enter a rate per square foot.' };
  }
  const rateCentsPerSqft = Math.round(input.rateCentsPerSqft);
  if (!Number.isSafeInteger(rateCentsPerSqft)) {
    return { ok: false, error: 'Square-foot rate is too large.' };
  }

  if (!Number.isFinite(input.sqft) || input.sqft <= 0 || !Number.isInteger(input.sqft)) {
    return { ok: false, error: 'Enter the cleanable square footage for this bid.' };
  }

  const visits = resolveVisits(input);
  if (!visits.ok) return visits;

  const visitsInPeriod = roundVisitCount(visits.visits);
  const visitAmountCents = Math.round(rateCentsPerSqft * input.sqft);
  const amountCents = Math.round(visitAmountCents * visitsInPeriod);
  if (!Number.isSafeInteger(visitAmountCents) || !Number.isSafeInteger(amountCents)) {
    return { ok: false, error: 'Square-foot bid is too large.' };
  }

  let productionSqftPerHour: number | null = null;
  let estimatedHoursPerVisit: number | null = null;
  if (input.productionSqftPerHour != null && input.productionSqftPerHour !== 0) {
    if (!Number.isFinite(input.productionSqftPerHour) || input.productionSqftPerHour <= 0) {
      return { ok: false, error: 'Production rate must be square feet per hour.' };
    }
    productionSqftPerHour = Math.round(input.productionSqftPerHour * 100) / 100;
    estimatedHoursPerVisit = Math.round((input.sqft / productionSqftPerHour) * 100) / 100;
  }

  return {
    ok: true,
    breakdown: {
      rateCentsPerSqft,
      billableSqft: input.sqft,
      visitAmountCents,
      visitsInPeriod,
      period: visits.period,
      amountCents,
      estimatedHoursPerVisit,
      productionSqftPerHour,
    },
  };
}

export function resolveBillableSqft(
  raw: string,
  defaultSqft: number | null | undefined,
): { ok: true; sqft: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/,/g, '');
  if (!trimmed) {
    if (defaultSqft != null && Number.isInteger(defaultSqft) && defaultSqft > 0) {
      return { ok: true, sqft: defaultSqft };
    }
    return { ok: false, error: 'Enter the cleanable square footage for this bid.' };
  }
  const sqft = Number(trimmed);
  if (!Number.isFinite(sqft) || !Number.isInteger(sqft) || sqft <= 0) {
    return {
      ok: false,
      error: 'Square footage on a line must be a whole number greater than zero.',
    };
  }
  return { ok: true, sqft };
}

export function formatVisitCount(visits: number): string {
  const rounded = roundVisitCount(visits);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

/** Customer- and office-facing lines that explain how a square-foot bid was priced. */
export function sqftBidSummaryLines(bid: SqftBidBreakdown, currency = 'USD'): string[] {
  const rate = formatQuoteMoney(bid.rateCentsPerSqft, currency);
  const perVisit = formatQuoteMoney(bid.visitAmountCents, currency);
  const total = formatQuoteMoney(bid.amountCents, currency);
  const sqft = bid.billableSqft.toLocaleString('en-US');
  const lines = [`${rate} / sq ft × ${sqft} sq ft = ${perVisit} per visit`];

  if (bid.period === 'month') {
    lines.push(
      `${formatVisitCount(bid.visitsInPeriod)} visits / month = ${total} monthly contract`,
    );
  }

  if (bid.estimatedHoursPerVisit != null && bid.productionSqftPerHour != null) {
    lines.push(
      `About ${formatVisitCount(bid.estimatedHoursPerVisit)} labor hours per visit at ${bid.productionSqftPerHour.toLocaleString('en-US')} sq ft/hour`,
    );
  }

  return lines;
}

export type StoredSqftBid = {
  pricing_method: string | null;
  amount_cents: number;
  sqft_rate_cents?: number | null;
  billable_sqft?: number | null;
  bid_visits?: number | null;
  bid_period?: string | null;
  production_sqft_per_hour?: number | null;
  estimated_hours?: number | null;
};

/** Rebuild the explanation from columns saved on a quote line. Returns null for flat or hourly lines. */
export function breakdownFromStoredSqftBid(row: StoredSqftBid): SqftBidBreakdown | null {
  if (row.pricing_method !== 'per_sqft') return null;
  const rate = row.sqft_rate_cents;
  const sqft = row.billable_sqft;
  if (rate == null || sqft == null || rate < 0 || sqft <= 0) return null;
  const visits = row.bid_visits != null && row.bid_visits > 0 ? Number(row.bid_visits) : 1;
  const period: SqftBidPeriod = row.bid_period === 'month' ? 'month' : 'visit';
  const production =
    row.production_sqft_per_hour != null && Number(row.production_sqft_per_hour) > 0
      ? Number(row.production_sqft_per_hour)
      : null;
  const hours =
    row.estimated_hours != null && Number(row.estimated_hours) > 0
      ? Number(row.estimated_hours)
      : production
        ? Math.round((sqft / production) * 100) / 100
        : null;
  return {
    rateCentsPerSqft: rate,
    billableSqft: sqft,
    visitAmountCents: Math.round(rate * sqft),
    visitsInPeriod: Math.round(visits * 1000) / 1000,
    period,
    amountCents: row.amount_cents,
    estimatedHoursPerVisit: hours,
    productionSqftPerHour: production,
  };
}
