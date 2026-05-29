'use client';

import { useEffect } from 'react';
import type { QuoteEditSnapshot } from '@/lib/tenant/loadQuoteEditSnapshot';

export function useServerActionQuoteSnapshot(
  success: boolean | undefined,
  quoteSnapshot: QuoteEditSnapshot | undefined,
  onQuoteSnapshot: ((snapshot: QuoteEditSnapshot) => void) | undefined,
) {
  useEffect(() => {
    if (success && quoteSnapshot && onQuoteSnapshot) {
      onQuoteSnapshot(quoteSnapshot);
    }
  }, [success, quoteSnapshot, onQuoteSnapshot]);
}
