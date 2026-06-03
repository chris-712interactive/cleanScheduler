import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatUsdFromCents } from '@/lib/format/money';
import type { CustomerWalletPortalView } from '@/lib/promotions/loadCustomerWalletPortal';
import styles from './customerWallet.module.scss';

export function CustomerWalletBalanceCard({
  wallets,
  showReferralsLink = true,
}: {
  wallets: CustomerWalletPortalView[];
  showReferralsLink?: boolean;
}) {
  const visible = wallets.filter((wallet) => wallet.balanceCents > 0);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((wallet) => (
        <section key={wallet.tenantId} className={`${styles.card} ${styles.balanceCard}`}>
          <div className={styles.cardBody}>
            <div className={styles.balanceHeader}>
              <div className={styles.balanceIcon} aria-hidden>
                <Wallet size={22} />
              </div>
              <div>
                <p className={styles.eyebrow}>Account credit</p>
                {visible.length > 1 ? (
                  <p className={styles.tenantName}>{wallet.tenantName}</p>
                ) : null}
              </div>
            </div>
            <p className={styles.balanceAmount}>{formatUsdFromCents(wallet.balanceCents)}</p>
            <p className={styles.balanceHint}>
              Apply this credit when you review a quote or pay an invoice online.
            </p>
            {showReferralsLink ? (
              <div className={styles.balanceActions}>
                <Button variant="secondary" size="sm" as={Link} href="/referrals">
                  Referrals & credits
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </>
  );
}
