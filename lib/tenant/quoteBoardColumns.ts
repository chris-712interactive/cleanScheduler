import type { QuoteStatus } from '@/lib/tenant/quoteLabels';

/** Left-to-right pipeline on the quotes board. */
export const QUOTE_BOARD_COLUMN_ORDER = ['draft', 'sent', 'accepted', 'declined', 'expired'] as const satisfies readonly QuoteStatus[];

export type QuoteBoardColumnStatus = (typeof QUOTE_BOARD_COLUMN_ORDER)[number];

export function columnDroppableId(status: QuoteBoardColumnStatus): string {
  return `column-${status}`;
}
