import Link from 'next/link';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import type { CustomerQuoteListRow } from '@/lib/customer/customerQuoteList';
import styles from './quotes.module.scss';

function listStatusLabel(status: QuoteStatus): string {
  if (status === 'sent') return 'Awaiting your response';
  return QUOTE_STATUS_LABEL[status];
}

function listStatusTone(status: QuoteStatus) {
  if (status === 'accepted') return 'brand' as const;
  if (status === 'declined') return 'neutral' as const;
  if (status === 'expired') return 'warning' as const;
  if (status === 'sent') return 'info' as const;
  return 'neutral' as const;
}

function formatValidUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CustomerQuoteListCard({
  row,
  emphasis = false,
}: {
  row: CustomerQuoteListRow;
  emphasis?: boolean;
}) {
  const provider = row.tenants?.name ?? 'Provider';
  const isActionable = row.status === 'sent';
  const validUntil = formatValidUntil(row.valid_until);

  return (
    <Link
      href={`/quotes/${row.id}`}
      className={[styles.listCard, emphasis ? styles.listCardEmphasis : ''].filter(Boolean).join(' ')}
    >
      <div className={styles.listCardTop}>
        <p className={styles.listCardProvider}>{provider}</p>
        <StatusPill tone={listStatusTone(row.status)}>{listStatusLabel(row.status)}</StatusPill>
      </div>
      <h2 className={styles.listCardTitle}>{row.title}</h2>
      <div className={styles.listCardFooter}>
        <p className={styles.listCardAmount}>{formatQuoteMoney(row.amount_cents, row.currency)}</p>
        <p className={styles.listCardMeta}>
          {validUntil ? `Valid through ${validUntil}` : `Updated ${new Date(row.updated_at).toLocaleDateString()}`}
        </p>
      </div>
      <p className={styles.listCardAction}>{isActionable ? 'Review & respond →' : 'View quote →'}</p>
    </Link>
  );
}
