import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCentsFromDollars } from '@/lib/billing/parseMoney';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export function positiveAmountCents(value: unknown): number | null {
  if (value == null) return null;
  const cents = Number(value);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return Math.round(cents);
}

/** Resolve billable cents from a visit row (sync — use joined quote amount when present). */
export function resolveExpectedAmountCentsSync(params: {
  expectedAmountCents?: number | null;
  quoteAmountCents?: number | null;
}): number | null {
  const stored = positiveAmountCents(params.expectedAmountCents);
  if (stored != null) return stored;
  return positiveAmountCents(params.quoteAmountCents);
}

export function visitHasBillableAmount(params: {
  expectedAmountCents?: number | null;
  quoteAmountCents?: number | null;
}): boolean {
  return resolveExpectedAmountCentsSync(params) != null;
}

export async function fetchQuoteAmountCents(
  admin: Admin,
  tenantId: string,
  quoteId: string,
): Promise<number | null> {
  const { data } = await admin
    .from('tenant_quotes')
    .select('amount_cents')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return positiveAmountCents(data?.amount_cents);
}

export async function resolveVisitExpectedAmountCents(
  admin: Admin,
  params: {
    tenantId: string;
    expectedAmountCents?: number | null;
    quoteId?: string | null;
  },
): Promise<number | null> {
  const stored = positiveAmountCents(params.expectedAmountCents);
  if (stored != null) return stored;
  if (!params.quoteId) return null;
  return fetchQuoteAmountCents(admin, params.tenantId, params.quoteId);
}

export async function resolveScheduleJobPriceCents(
  admin: Admin,
  params: {
    tenantId: string;
    quoteId: string | null;
    jobPriceDollars: string;
  },
): Promise<{ expectedAmountCents: number } | { error: string }> {
  let expectedAmountCents: number | null = null;

  if (params.quoteId) {
    expectedAmountCents = await fetchQuoteAmountCents(admin, params.tenantId, params.quoteId);
  }

  const manualCents = parseCentsFromDollars(params.jobPriceDollars);
  if (manualCents != null && manualCents > 0) {
    expectedAmountCents = manualCents;
  }

  if (expectedAmountCents == null) {
    return {
      error: 'Add a priced quote or enter a job price before scheduling this visit.',
    };
  }

  return { expectedAmountCents };
}

export const FIELD_EMPLOYEE_NO_PRICE_MESSAGE =
  'Your office has not set a price for this job yet. Contact them before completing the visit.';

export const OFFICE_NO_PRICE_MESSAGE =
  'Set a job price on this visit before completing it. Use the Job price section above.';

export const OFFICE_SET_PRICE_HINT =
  'Field crews use this amount at job close — set it here before dispatch.';
