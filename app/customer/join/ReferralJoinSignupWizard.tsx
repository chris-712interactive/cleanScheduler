'use client';

import Link from 'next/link';
import { SmsOptInCheckboxLabel } from '@/components/legal/SmsOptInCheckboxLabel';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ReferralJoinLandingView } from '@/lib/referrals/loadReferralJoinLanding';
import type { ReferralJoinPrefill } from '@/lib/referrals/referralRefereeOnboarding';
import {
  draftFromPrefill,
  nextSignupStep,
  previousSignupStep,
  REFERRAL_SIGNUP_STEPS,
  signupStepIndex,
  validateReferralSignupStep,
  type ReferralSignupDraft,
  type ReferralSignupFieldErrors,
  type ReferralSignupStep,
} from '@/lib/referrals/referralSignupDraft';
import type { ReferralJoinActionState } from './actions';
import styles from './join.module.scss';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={styles.fieldError} role="alert">
      {message}
    </p>
  );
}

export function ReferralJoinSignupWizard({
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
  const errorRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<ReferralSignupStep>('profile');
  const [draft, setDraft] = useState<ReferralSignupDraft>(() => draftFromPrefill(prefill));
  const [stepErrors, setStepErrors] = useState<ReferralSignupFieldErrors>({});
  const [stepMessage, setStepMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state.draft) {
      setDraft(state.draft);
    }
    if (state.error) {
      setStep('account');
      queueMicrotask(() =>
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    }
  }, [state.draft, state.error]);

  const patchDraft = (patch: Partial<ReferralSignupDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setStepErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof ReferralSignupDraft)[]) {
        delete next[key];
      }
      return next;
    });
    setStepMessage(null);
  };

  const goNext = () => {
    const result = validateReferralSignupStep(step, draft);
    if (!result.ok) {
      setStepErrors(result.errors);
      setStepMessage(result.message);
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    setStepErrors({});
    setStepMessage(null);
    const next = nextSignupStep(step);
    if (next) setStep(next);
  };

  const goBack = () => {
    setStepErrors({});
    setStepMessage(null);
    const previous = previousSignupStep(step);
    if (previous) setStep(previous);
  };

  const stepMeta = REFERRAL_SIGNUP_STEPS[signupStepIndex(step)]!;
  const topError = state.error ?? stepMessage;

  return (
    <>
      <p className={styles.lead}>
        {isExisting
          ? `We found your profile with ${landing.tenantName}. Finish the steps below to access your portal and complete your referral.`
          : `Tell ${landing.tenantName} a bit about yourself and create your portal login.`}
      </p>

      <nav className={styles.stepNav} aria-label="Signup progress">
        {REFERRAL_SIGNUP_STEPS.map((entry, index) => {
          const active = entry.id === step;
          const complete = signupStepIndex(step) > index;
          return (
            <span
              key={entry.id}
              className={[
                styles.stepNavItem,
                active ? styles.stepNavItemActive : '',
                complete ? styles.stepNavItemComplete : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.stepNavBadge}>{index + 1}</span>
              <span className={styles.stepNavLabel}>{entry.label}</span>
            </span>
          );
        })}
      </nav>

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

        <input type="hidden" name="first_name" value={draft.firstName} />
        <input type="hidden" name="last_name" value={draft.lastName} />
        <input type="hidden" name="phone" value={draft.phone} />
        <input type="hidden" name="service_address_line1" value={draft.serviceAddressLine1} />
        <input type="hidden" name="service_address_line2" value={draft.serviceAddressLine2} />
        <input type="hidden" name="service_city" value={draft.serviceCity} />
        <input type="hidden" name="service_state" value={draft.serviceState} />
        <input type="hidden" name="service_postal_code" value={draft.servicePostalCode} />
        {draft.smsOptIn ? <input type="hidden" name="sms_opt_in" value="on" /> : null}
        {draft.marketingEmailOptIn ? (
          <input type="hidden" name="marketing_email_opt_in" value="on" />
        ) : null}

        <div ref={errorRef}>
          {topError ? (
            <p className={styles.error} role="alert">
              {topError}
            </p>
          ) : null}
        </div>

        {state.duplicateAccount ? (
          <p className={styles.hint}>
            <Link href={signInUrl} className={styles.link}>
              Sign in
            </Link>{' '}
            with this email, then return to your referral link if needed.
          </p>
        ) : null}

        {step === 'profile' ? (
          <section className={styles.stepPanel} aria-labelledby="referral_signup_profile_heading">
            <h3 id="referral_signup_profile_heading" className={styles.stepTitle}>
              Step {signupStepIndex(step) + 1} of {REFERRAL_SIGNUP_STEPS.length}: {stepMeta.label}
            </h3>

            <label className={styles.label} htmlFor="referral_first_name">
              First name
            </label>
            <input
              id="referral_first_name"
              className={styles.input}
              required
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(event) => patchDraft({ firstName: event.target.value })}
              readOnly={isExisting && Boolean(prefill.firstName)}
            />
            <FieldError message={stepErrors.firstName} />

            <label className={styles.label} htmlFor="referral_last_name">
              Last name (optional)
            </label>
            <input
              id="referral_last_name"
              className={styles.input}
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(event) => patchDraft({ lastName: event.target.value })}
              readOnly={isExisting && Boolean(prefill.lastName)}
            />

            <label className={styles.label} htmlFor="referral_signup_email">
              Email
            </label>
            <input
              id="referral_signup_email"
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
              type="tel"
              className={styles.input}
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={draft.phone}
              onChange={(event) => patchDraft({ phone: event.target.value })}
            />
            <FieldError message={stepErrors.phone} />
          </section>
        ) : null}

        {step === 'address' ? (
          <section className={styles.stepPanel} aria-labelledby="referral_signup_address_heading">
            <h3 id="referral_signup_address_heading" className={styles.stepTitle}>
              Step {signupStepIndex(step) + 1} of {REFERRAL_SIGNUP_STEPS.length}: {stepMeta.label}
            </h3>

            <label className={styles.label} htmlFor="referral_address_line1">
              Street address
            </label>
            <input
              id="referral_address_line1"
              className={styles.input}
              autoComplete="address-line1"
              value={draft.serviceAddressLine1}
              onChange={(event) => patchDraft({ serviceAddressLine1: event.target.value })}
            />
            <FieldError message={stepErrors.serviceAddressLine1} />

            <label className={styles.label} htmlFor="referral_address_line2">
              Apt / unit (optional)
            </label>
            <input
              id="referral_address_line2"
              className={styles.input}
              autoComplete="address-line2"
              value={draft.serviceAddressLine2}
              onChange={(event) => patchDraft({ serviceAddressLine2: event.target.value })}
            />

            <label className={styles.label} htmlFor="referral_city">
              City
            </label>
            <input
              id="referral_city"
              className={styles.input}
              autoComplete="address-level2"
              value={draft.serviceCity}
              onChange={(event) => patchDraft({ serviceCity: event.target.value })}
            />
            <FieldError message={stepErrors.serviceCity} />

            <label className={styles.label} htmlFor="referral_state">
              State / region
            </label>
            <input
              id="referral_state"
              className={styles.input}
              autoComplete="address-level1"
              value={draft.serviceState}
              onChange={(event) => patchDraft({ serviceState: event.target.value })}
            />
            <FieldError message={stepErrors.serviceState} />

            <label className={styles.label} htmlFor="referral_postal_code">
              Postal code
            </label>
            <input
              id="referral_postal_code"
              className={styles.input}
              autoComplete="postal-code"
              value={draft.servicePostalCode}
              onChange={(event) => patchDraft({ servicePostalCode: event.target.value })}
            />
            <FieldError message={stepErrors.servicePostalCode} />
          </section>
        ) : null}

        {step === 'account' ? (
          <section className={styles.stepPanel} aria-labelledby="referral_signup_account_heading">
            <h3 id="referral_signup_account_heading" className={styles.stepTitle}>
              Step {signupStepIndex(step) + 1} of {REFERRAL_SIGNUP_STEPS.length}: {stepMeta.label}
            </h3>

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
              value={draft.password}
              onChange={(event) => patchDraft({ password: event.target.value })}
            />
            <FieldError message={stepErrors.password} />

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
              value={draft.confirmPassword}
              onChange={(event) => patchDraft({ confirmPassword: event.target.value })}
            />
            <FieldError message={stepErrors.confirmPassword} />

            <label className={styles.checkboxRow} htmlFor="referral_sms_opt_in">
              <input
                id="referral_sms_opt_in"
                type="checkbox"
                checked={draft.smsOptIn}
                onChange={(event) => patchDraft({ smsOptIn: event.target.checked })}
              />
              <SmsOptInCheckboxLabel />
            </label>

            <label className={styles.checkboxRow} htmlFor="referral_marketing_opt_in">
              <input
                id="referral_marketing_opt_in"
                type="checkbox"
                checked={draft.marketingEmailOptIn}
                onChange={(event) => patchDraft({ marketingEmailOptIn: event.target.checked })}
              />
              <span>Send me occasional offers and updates by email</span>
            </label>

            {draft.smsOptIn ? (
              <>
                <label className={styles.label} htmlFor="referral_account_phone">
                  Phone for SMS
                </label>
                <input
                  id="referral_account_phone"
                  type="tel"
                  className={styles.input}
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  value={draft.phone}
                  onChange={(event) => patchDraft({ phone: event.target.value })}
                />
                <FieldError message={stepErrors.phone} />
              </>
            ) : null}
          </section>
        ) : null}

        <div className={styles.stepActions}>
          {step !== 'profile' ? (
            <Button type="button" variant="secondary" onClick={goBack} disabled={pending}>
              Back
            </Button>
          ) : null}
          {step !== 'account' ? (
            <Button type="button" variant="primary" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Creating account…' : 'Create account & continue'}
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
