'use client';

import dynamic from 'next/dynamic';
import styles from './quotes.module.scss';

function LineItemsEditorSkeleton() {
  return (
    <div
      className={styles.lineItemsFieldset}
      aria-busy="true"
      aria-label="Loading line items editor"
    >
      <p className={styles.hint}>Loading services editor…</p>
    </div>
  );
}

export const QuoteLineItemsEditor = dynamic(
  () => import('./QuoteLineItemsEditor').then((m) => ({ default: m.QuoteLineItemsEditor })),
  { loading: () => <LineItemsEditorSkeleton /> },
);

export {
  createEmptyQuoteLineDraft,
  draftsFromQuoteLineRows,
  type QuoteLineItemDraft,
} from './QuoteLineItemsEditor';
