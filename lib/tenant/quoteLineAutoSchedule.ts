import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';

export function isRecurringQuoteLineFrequency(frequency: QuoteLineFrequency): boolean {
  return frequency !== 'one_time';
}

/** Suggested initial visit count when auto-scheduling a recurring line. */
export function defaultAutoScheduleVisitCount(frequency: QuoteLineFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 4;
    case 'biweekly':
      return 2;
    case 'monthly':
      return 1;
    case 'custom':
      return 2;
    default:
      return 1;
  }
}

export function parseAutoScheduleVisitCount(raw: string, frequency: QuoteLineFrequency): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    return isRecurringQuoteLineFrequency(frequency) ? defaultAutoScheduleVisitCount(frequency) : 1;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(52, parsed);
}

export function resolveAutoScheduleVisitCount(
  frequency: QuoteLineFrequency,
  stored: number | null | undefined,
): number {
  if (!isRecurringQuoteLineFrequency(frequency)) return 1;
  if (stored != null && stored >= 1) return Math.min(52, stored);
  return defaultAutoScheduleVisitCount(frequency);
}

export function parseAutoScheduleFlag(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value === 'true' || value === 'on' || value === '1' || value === 'yes';
}
