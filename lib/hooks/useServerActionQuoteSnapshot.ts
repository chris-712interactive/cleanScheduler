'use client';

import { useEffect, useRef } from 'react';
import type { QuoteEditSnapshot } from '@/lib/tenant/loadQuoteEditSnapshot';

export function useServerActionQuoteSnapshot(
  success: boolean | undefined,
  quoteSnapshot: QuoteEditSnapshot | undefined,
  onQuoteSnapshot: ((snapshot: QuoteEditSnapshot) => void) | undefined,
) {
  const lastAppliedRef = useRef<unknown>(undefined);

  useEffect(() => {
    if (!success || !quoteSnapshot || !onQuoteSnapshot) {
      if (!success) lastAppliedRef.current = undefined;
      return;
    }

    if (lastAppliedRef.current === quoteSnapshot) return;
    lastAppliedRef.current = quoteSnapshot;
    onQuoteSnapshot(quoteSnapshot);
  }, [success, quoteSnapshot, onQuoteSnapshot]);
}
