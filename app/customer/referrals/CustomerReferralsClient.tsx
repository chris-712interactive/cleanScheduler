'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { CustomerReferralPortalView } from '@/lib/referrals/loadCustomerReferralPortal';
import type { CustomerReferralActivityRow } from '@/lib/referrals/loadCustomerReferralActivity';
import { CustomerReferralSharePanel } from './CustomerReferralSharePanel';
import styles from './referrals.module.scss';

function activityTone(
  status: CustomerReferralActivityRow['status'],
): 'neutral' | 'success' | 'warning' {
  if (status === 'qualified') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export function CustomerReferralsClient({
  view,
  recentActivity,
}: {
  view: CustomerReferralPortalView;
  recentActivity: CustomerReferralActivityRow[];
}) {
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

      <CustomerReferralSharePanel shareUrl={view.shareUrl} shareHeadline={view.shareHeadline} />

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

      {recentActivity.length > 0 ? (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Your referrals</h3>
          <ul className={styles.activityList}>
            {recentActivity.map((row) => (
              <li key={row.id} className={styles.activityItem}>
                <span className={styles.activityName}>{row.refereeLabel}</span>
                <StatusPill tone={activityTone(row.status)}>{row.status}</StatusPill>
                <span className={styles.activityDate}>
                  {row.qualifiedAt
                    ? `Qualified ${new Date(row.qualifiedAt).toLocaleDateString()}`
                    : `Joined ${new Date(row.attributedAt).toLocaleDateString()}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.termsText ? (
        <section className={styles.terms}>
          <h3 className={styles.cardTitle}>Program terms</h3>
          <p>{view.termsText}</p>
        </section>
      ) : null}
    </div>
  );
}
