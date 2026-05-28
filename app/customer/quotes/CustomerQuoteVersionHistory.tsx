import Link from 'next/link';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import styles from './quotes.module.scss';

export type CustomerQuoteVersionRow = {
  id: string;
  version_number: number;
  title: string;
  status: QuoteStatus;
};

export function CustomerQuoteVersionHistory({
  versions,
  currentQuoteId,
}: {
  versions: CustomerQuoteVersionRow[];
  currentQuoteId: string;
}) {
  if (versions.length <= 1) {
    return null;
  }

  const earlierCount = versions.length - 1;

  return (
    <details className={styles.versionDetails}>
      <summary className={styles.versionSummary}>
        {earlierCount} earlier version{earlierCount === 1 ? '' : 's'}
      </summary>
      <ul className={styles.versionList}>
        {versions.map((v) => (
          <li key={v.id} className={styles.versionItem}>
            {v.id === currentQuoteId ? (
              <span className={styles.versionCurrent}>
                Version {v.version_number} · {QUOTE_STATUS_LABEL[v.status]} (current)
              </span>
            ) : (
              <Link href={`/quotes/${v.id}`} className={styles.titleLink}>
                Version {v.version_number}
              </Link>
            )}
            {v.id !== currentQuoteId ? (
              <span className={styles.muted}>{QUOTE_STATUS_LABEL[v.status]}</span>
            ) : null}
            <span className={styles.muted}>{v.title}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
