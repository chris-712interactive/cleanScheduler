'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { quoteDecisionNotice } from '@/lib/tenant/quoteDecisionLive';
import { useQuoteDecisionRealtime } from './useQuoteDecisionRealtime';
import styles from './quotes.module.scss';

export function QuotePipelineLiveSync({
  tenantId,
  quoteId,
}: {
  tenantId: string;
  /** When set, only this quote refreshes the open detail page. */
  quoteId?: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  useQuoteDecisionRealtime(
    tenantId,
    (row) => {
      if (quoteId && row.id !== quoteId) return;
      setNotice(quoteDecisionNotice(row.status, row.title));
      router.refresh();
    },
    quoteId ? `quote-${quoteId}` : 'list',
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <p className={styles.liveDecision} role="status">
      {notice}
    </p>
  );
}
