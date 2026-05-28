import type { QuoteStatus } from '@/lib/tenant/quoteLabels';

/**
 * List order: customer-facing pending first, then drafts, then outcomes.
 * Within each status, newest `created_at` first.
 */
const LIST_PRIORITY: Record<QuoteStatus, number> = {
  sent: 0,
  draft: 1,
  accepted: 2,
  declined: 3,
  expired: 4,
};

export function compareQuotesByListPriority(
  a: { status: QuoteStatus; created_at: string },
  b: { status: QuoteStatus; created_at: string },
): number {
  const pa = LIST_PRIORITY[a.status] ?? 99;
  const pb = LIST_PRIORITY[b.status] ?? 99;
  if (pa !== pb) return pa - pb;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortQuotesByListPriority<T extends { status: QuoteStatus; created_at: string }>(
  quotes: T[],
): T[] {
  return [...quotes].sort(compareQuotesByListPriority);
}
