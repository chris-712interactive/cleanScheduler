import type { QuoteStatus } from '@/lib/tenant/quoteLabels';

export type CustomerQuoteResponsePatch = {
  status: QuoteStatus;
  acceptedAt: string | null;
  canRespond: false;
};
