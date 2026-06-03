import Link from 'next/link';
import { formatUsdFromCents } from '@/lib/format/money';
import type { CustomerWalletPortalView } from '@/lib/promotions/loadCustomerWalletPortal';
import {
  walletTransactionKindLabel,
  walletTransactionSignedAmountCents,
} from '@/lib/promotions/walletTransactionDisplay';
import styles from './customerWallet.module.scss';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CustomerWalletActivityList({ wallet }: { wallet: CustomerWalletPortalView }) {
  if (wallet.recentTransactions.length === 0) {
    return (
      <section className={styles.card}>
        <div className={styles.cardBody}>
          <h3 className={styles.sectionTitle}>Account credit</h3>
          <p className={styles.balanceAmount}>{formatUsdFromCents(wallet.balanceCents)}</p>
          <p className={styles.emptyHint}>
            Credits from referrals and promo codes will appear here. Use them on quotes or invoices.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.activityHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Account credit</h3>
            <p className={styles.balanceAmountCompact}>
              {formatUsdFromCents(wallet.balanceCents)} available
            </p>
          </div>
          <Link href="/quotes" className={styles.inlineLink}>
            Use on a quote
          </Link>
        </div>
        <ul className={styles.activityList}>
          {wallet.recentTransactions.map((tx) => {
            const signed = walletTransactionSignedAmountCents(tx.kind, tx.amountCents);
            return (
              <li key={tx.id} className={styles.activityRow}>
                <div className={styles.activityCopy}>
                  <p className={styles.activityLabel}>{walletTransactionKindLabel(tx.kind)}</p>
                  {tx.note ? <p className={styles.activityNote}>{tx.note}</p> : null}
                  <p className={styles.activityWhen}>{formatWhen(tx.createdAt)}</p>
                </div>
                <p
                  className={styles.activityAmount}
                  data-direction={signed >= 0 ? 'credit' : 'debit'}
                >
                  {signed >= 0 ? '+' : '−'}
                  {formatUsdFromCents(Math.abs(signed))}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
