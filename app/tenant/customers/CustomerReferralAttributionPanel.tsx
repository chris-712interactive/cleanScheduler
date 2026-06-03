'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { CustomerReferralAttributionView } from '@/lib/referrals/loadCustomerReferralAttribution';
import {
  attributeCustomerReferralAction,
  type ReferralAttributionActionState,
} from './referralAttributionActions';
import styles from './customers.module.scss';

const initialState: ReferralAttributionActionState = {};

function attributionStatusTone(
  status: CustomerReferralAttributionView['status'],
): 'neutral' | 'success' | 'warning' {
  if (status === 'qualified') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export function CustomerReferralAttributionPanel({
  tenantSlug,
  customerId,
  canEdit,
  asReferee,
  asReferrer,
}: {
  tenantSlug: string;
  customerId: string;
  canEdit: boolean;
  asReferee: CustomerReferralAttributionView | null;
  asReferrer: { pendingCount: number; qualifiedCount: number };
}) {
  const [state, formAction, pending] = useActionState(
    attributeCustomerReferralAction,
    initialState,
  );

  return (
    <section className={styles.referralPanel}>
      {asReferee ? (
        <div className={styles.referralSummary}>
          <p className={styles.sectionHint}>
            Referred by{' '}
            <Link href={`/customers/${asReferee.referrerCustomerId}`} className={styles.inlineLink}>
              {asReferee.referrerName}
            </Link>
            {asReferee.referralCode ? ` (code ${asReferee.referralCode})` : ''}
          </p>
          <p className={styles.referralMeta}>
            <StatusPill tone={attributionStatusTone(asReferee.status)}>
              {asReferee.status}
            </StatusPill>
            {' · '}
            {asReferee.attributionSource === 'manual' ? 'Staff attributed' : 'Link capture'}
            {' · '}
            Attributed {new Date(asReferee.attributedAt).toLocaleDateString()}
            {asReferee.qualifiedAt
              ? ` · Qualified ${new Date(asReferee.qualifiedAt).toLocaleDateString()}`
              : ''}
          </p>
        </div>
      ) : canEdit ? (
        <>
          <p className={styles.sectionHint}>
            Attribute a referring customer when someone joined without using a referral link.
            Rewards still qualify on first paid invoice.
          </p>
          <form action={formAction} className={styles.referralForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="referee_customer_id" value={customerId} />
            <label className={styles.label} htmlFor="referrer_email">
              Referrer email
            </label>
            <div className={styles.walletFormRow}>
              <input
                id="referrer_email"
                name="referrer_email"
                type="email"
                className={styles.input}
                placeholder="referrer@example.com"
                autoComplete="off"
                disabled={pending}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                Attribute
              </Button>
            </div>
            {state.error ? (
              <p className={styles.bannerError} role="alert">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className={styles.bannerOk} role="status">
                Referral attributed. Refresh if the summary has not updated yet.
              </p>
            ) : null}
          </form>
        </>
      ) : (
        <p className={styles.sectionHint}>No referral attribution on file for this customer.</p>
      )}

      {asReferrer.pendingCount > 0 || asReferrer.qualifiedCount > 0 ? (
        <p className={styles.referralMeta}>
          This customer referred {asReferrer.qualifiedCount} qualified and {asReferrer.pendingCount}{' '}
          pending referral{asReferrer.pendingCount + asReferrer.qualifiedCount === 1 ? '' : 's'}.{' '}
          <Link href="/referrals" className={styles.inlineLink}>
            View referral activity
          </Link>
        </p>
      ) : null}
    </section>
  );
}
