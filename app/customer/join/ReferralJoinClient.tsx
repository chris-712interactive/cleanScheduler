'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ReferralJoinLandingView } from '@/lib/referrals/loadReferralJoinLanding';
import type { ReferralJoinPrefill } from '@/lib/referrals/referralRefereeOnboarding';
import {
  continueReferralJoinAction,
  signupReferralRefereeAction,
  type ReferralJoinActionState,
} from './actions';
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

function ReferralJoinSignupStep({
  landing,
  signInUrl,
  mode,
  email,
  prefill,
  state,
  formAction,
  pending,
}: {
  landing: ReferralJoinLandingView;
  signInUrl: string;
  mode: 'new' | 'existing';
  email: string;
  prefill: ReferralJoinPrefill;
  state: ReferralJoinActionState;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  const isExisting = mode === 'existing';

  return (
    <>
      <p className={styles.lead}>
        {isExisting
          ? `We found your profile with ${landing.tenantName}. Create a password to access your portal and complete your referral.`
          : `Tell ${landing.tenantName} a bit about yourself and create your portal login.`}
      </p>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="referral_code" value={landing.referralCode} />
        <input type="hidden" name="tenant_id" value={landing.tenantId} />
        <input type="hidden" name="email" value={email} />
        {prefill.customerId ? (
          <input type="hidden" name="existing_customer_id" value={prefill.customerId} />
        ) : null}
        {prefill.identityId ? (
          <input type="hidden" name="existing_identity_id" value={prefill.identityId} />
        ) : null}

        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}

        {state.duplicateAccount ? (
          <p className={styles.hint}>
            <Link href={signInUrl} className={styles.link}>
              Sign in
            </Link>{' '}
            with this email, then return to your referral link if needed.
          </p>
        ) : null}

        <label className={styles.label} htmlFor="referral_first_name">
          First name
        </label>
        <input
          id="referral_first_name"
          name="first_name"
          className={styles.input}
          required
          autoComplete="given-name"
          defaultValue={prefill.firstName}
          readOnly={isExisting && Boolean(prefill.firstName)}
        />

        <label className={styles.label} htmlFor="referral_last_name">
          Last name (optional)
        </label>
        <input
          id="referral_last_name"
          name="last_name"
          className={styles.input}
          autoComplete="family-name"
          defaultValue={prefill.lastName}
          readOnly={isExisting && Boolean(prefill.lastName)}
        />

        <label className={styles.label} htmlFor="referral_signup_email">
          Email
        </label>
        <input
          id="referral_signup_email"
          name="email_display"
          type="email"
          className={styles.input}
          value={email}
          readOnly
          autoComplete="username email"
        />

        <label className={styles.label} htmlFor="referral_phone">
          Phone (optional)
        </label>
        <input
          id="referral_phone"
          name="phone"
          type="tel"
          className={styles.input}
          autoComplete="tel"
          placeholder="(555) 123-4567"
          defaultValue={prefill.phone}
        />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Service address</legend>
          <label className={styles.label} htmlFor="referral_address_line1">
            Street address
          </label>
          <input
            id="referral_address_line1"
            name="service_address_line1"
            className={styles.input}
            autoComplete="address-line1"
            defaultValue={prefill.serviceAddressLine1}
          />

          <label className={styles.label} htmlFor="referral_address_line2">
            Apt / unit (optional)
          </label>
          <input
            id="referral_address_line2"
            name="service_address_line2"
            className={styles.input}
            autoComplete="address-line2"
            defaultValue={prefill.serviceAddressLine2}
          />

          <label className={styles.label} htmlFor="referral_city">
            City
          </label>
          <input
            id="referral_city"
            name="service_city"
            className={styles.input}
            autoComplete="address-level2"
            defaultValue={prefill.serviceCity}
          />

          <label className={styles.label} htmlFor="referral_state">
            State / region
          </label>
          <input
            id="referral_state"
            name="service_state"
            className={styles.input}
            autoComplete="address-level1"
            defaultValue={prefill.serviceState}
          />

          <label className={styles.label} htmlFor="referral_postal_code">
            Postal code
          </label>
          <input
            id="referral_postal_code"
            name="service_postal_code"
            className={styles.input}
            autoComplete="postal-code"
            defaultValue={prefill.servicePostalCode}
          />
        </fieldset>

        <label className={styles.label} htmlFor="referral_password">
          Password
        </label>
        <input
          id="referral_password"
          name="password"
          type="password"
          className={styles.input}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <label className={styles.label} htmlFor="referral_confirm_password">
          Confirm password
        </label>
        <input
          id="referral_confirm_password"
          name="confirm_password"
          type="password"
          className={styles.input}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <label className={styles.checkboxRow} htmlFor="referral_sms_opt_in">
          <input id="referral_sms_opt_in" name="sms_opt_in" type="checkbox" value="on" />
          <span>
            I agree to receive text messages about my bookings and account. Message and data rates
            may apply. Reply STOP to unsubscribe.
          </span>
        </label>

        <label className={styles.checkboxRow} htmlFor="referral_marketing_opt_in">
          <input id="referral_marketing_opt_in" name="marketing_email_opt_in" type="checkbox" />
          <span>Send me occasional offers and updates by email</span>
        </label>

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account & continue'}
        </Button>
      </form>
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
        <ReferralJoinSignupStep
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
