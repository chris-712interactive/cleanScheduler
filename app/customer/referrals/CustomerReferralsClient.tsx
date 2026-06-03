'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CustomerReferralPortalView } from '@/lib/referrals/loadCustomerReferralPortal';
import styles from './referrals.module.scss';

export function CustomerReferralsClient({ view }: { view: CustomerReferralPortalView }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  async function copyText(value: string, kind: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className={styles.stack}>
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>{view.shareHeadline}</h2>
        <p className={styles.heroLead}>
          Share your personal link with friends. When they become a customer through your link,
          rewards are tracked here and paid to your wallet when they pay their first invoice.
        </p>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Your referral link</h3>
        <p className={styles.mono}>{view.shareUrl}</p>
        <div className={styles.actions}>
          <Button type="button" size="sm" onClick={() => copyText(view.shareUrl, 'link')}>
            {copied === 'link' ? 'Copied!' : 'Copy link'}
          </Button>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Your code</h3>
        <p className={styles.mono}>{view.referralCode}</p>
        <div className={styles.actions}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => copyText(view.referralCode, 'code')}
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </Button>
        </div>
      </section>

      <section className={styles.stats}>
        <div>
          <p className={styles.statValue}>{view.stats.pending}</p>
          <p className={styles.statLabel}>Pending referrals</p>
        </div>
        <div>
          <p className={styles.statValue}>{view.stats.qualified}</p>
          <p className={styles.statLabel}>Qualified referrals</p>
        </div>
      </section>

      {view.termsText ? (
        <section className={styles.terms}>
          <h3 className={styles.cardTitle}>Program terms</h3>
          <p>{view.termsText}</p>
        </section>
      ) : null}
    </div>
  );
}
