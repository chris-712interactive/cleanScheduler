/**
 * KeyValueList - description list (<dl>) with consistent type, alignment, and
 * truncation. Used heavily on detail pages (customer info, invoice summary,
 * appointment metadata, etc.).
 */
import type { ReactNode } from 'react';
import styles from './KeyValueList.module.scss';

export interface KeyValueItem {
  key: ReactNode;
  value: ReactNode;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  layout?: 'inline' | 'stacked';
  className?: string;
}

export function KeyValueList({ items, layout = 'inline', className }: KeyValueListProps) {
  return (
    <dl data-layout={layout} className={[styles.list, className].filter(Boolean).join(' ')}>
      {items.map((item, idx) => (
        <div key={idx} className={styles.row}>
          <dt className={styles.key}>{item.key}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
