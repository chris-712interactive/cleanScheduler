'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ReferralJoinLandingView } from '@/lib/referrals/loadReferralJoinLanding';
import {
  continueReferralJoinAction,
  signupReferralRefereeAction,
  type ReferralJoinActionState,
} from './actions';
import { ReferralJoinSignupWizard } from './ReferralJoinSignupWizard';
import styles from './join.module.scss';

const initialState: ReferralJoinActionState = {};

function ReferralJoinEmailStep({
  landing,
  signInUrl,
  state,
  formAction,
  pending,
}: {
  landing: ReferralJoinLandingView;
  signInUrl: string;
  state: ReferralJoinActionState;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <>
      <p className={styles.lead}>
        You were referred by <strong>{landing.referrerName}</strong>. Enter your email to get
        started with {landing.tenantName} and claim your referral.
      </p>

      {landing.refereeRewardLabel ? (
        <p className={styles.reward}>
          Referral reward: <strong>{landing.refereeRewardLabel}</strong> after your first paid
          invoice.
        </p>
      ) : null}

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="referral_code" value={landing.referralCode} />
        {state.error && !state.step ? (
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
          defaultValue={state.email ?? ''}
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Checking…' : 'Continue'}
        </Button>
      </form>

      <p className={styles.hint}>
        Already have a portal account?{' '}
        <Link href={signInUrl} className={styles.link}>
          Sign in
        </Link>
        .
      </p>
    </>
  );
}

export function ReferralJoinClient({
  landing,
  signInUrl,
}: {
  landing: ReferralJoinLandingView;
  signInUrl: string;
}) {
  const [lookupState, lookupAction, lookupPending] = useActionState(
    continueReferralJoinAction,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signupReferralRefereeAction,
    initialState,
  );

  const showSignup =
    lookupState.step === 'signup' && lookupState.email && lookupState.prefill && lookupState.mode;

  return (
    <div className={styles.stack}>
      {showSignup ? (
        <ReferralJoinSignupWizard
          landing={landing}
          signInUrl={signInUrl}
          mode={lookupState.mode!}
          email={lookupState.email!}
          prefill={lookupState.prefill!}
          state={signupState}
          formAction={signupAction}
          pending={signupPending}
        />
      ) : (
        <ReferralJoinEmailStep
          landing={landing}
          signInUrl={signInUrl}
          state={lookupState}
          formAction={lookupAction}
          pending={lookupPending}
        />
      )}
    </div>
  );
}
