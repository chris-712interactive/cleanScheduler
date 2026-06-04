'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { ReferralJoinLandingView } from '@/lib/referrals/loadReferralJoinLanding';
import { continueReferralJoinAction, type ReferralJoinActionState } from './actions';
import styles from './join.module.scss';

const initialState: ReferralJoinActionState = {};

export function ReferralJoinForm({
  landing,
  signInUrl,
}: {
  landing: ReferralJoinLandingView;
  signInUrl: string;
}) {
  const [state, formAction, pending] = useActionState(continueReferralJoinAction, initialState);

  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        You were referred by <strong>{landing.referrerName}</strong>. Enter the email address{' '}
        {landing.tenantName} uses for your account to open your portal invite and claim your
        referral.
      </p>

      {landing.refereeRewardLabel ? (
        <p className={styles.reward}>
          Referral reward: <strong>{landing.refereeRewardLabel}</strong> after your first paid
          invoice.
        </p>
      ) : null}

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="referral_code" value={landing.referralCode} />
        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}
        <label className={styles.label} htmlFor="referral_join_email">
          Your email
        </label>
        <input
          id="referral_join_email"
          name="email"
          type="email"
          className={styles.input}
          required
          autoComplete="email"
          placeholder="you@email.com"
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Looking up invite…' : 'Continue to portal setup'}
        </Button>
      </form>

      <p className={styles.hint}>
        Already finished portal setup?{' '}
        <Link href={signInUrl} className={styles.link}>
          Sign in
        </Link>
        .
      </p>
      <p className={styles.hint}>
        Have an invite link from email instead? Open that link first — your referral is saved for 30
        days in this browser.
      </p>
    </div>
  );
}
