import { sqftBidSummaryLines, type SqftBidBreakdown } from '@/lib/tenant/sqftBid';
import styles from './SqftBidBreakdown.module.scss';

export function SqftBidBreakdownView({
  breakdown,
  currency = 'USD',
}: {
  breakdown: SqftBidBreakdown;
  currency?: string;
}) {
  const lines = sqftBidSummaryLines(breakdown, currency);
  return (
    <ul className={styles.list}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
