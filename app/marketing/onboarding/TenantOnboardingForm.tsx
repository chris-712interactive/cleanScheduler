'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import zxcvbn from 'zxcvbn';
import { createTenantAndOwner, type TenantOnboardingState } from './actions';
import {
  formatPasswordFeedback,
  passwordStrengthLabel,
  passwordStrengthTone,
} from './passwordStrength';
import styles from './onboarding.module.scss';

const initialState: TenantOnboardingState = {};

export function TenantOnboardingForm({ domainSuffix }: { domainSuffix: string }) {
  const [state, formAction, pending] = useActionState(createTenantAndOwner, initialState);
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('residential');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    tone: 'idle' | 'ok' | 'warn' | 'error';
    message: string;
  }>({ tone: 'idle', message: 'Choose a unique slug for your workspace URL.' });

  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

  useEffect(() => {
    if (!slug.trim()) {
      setSlugStatus({ tone: 'idle', message: 'Choose a unique slug for your workspace URL.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/onboarding/slug-availability?slug=${encodeURIComponent(slug)}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as {
          available: boolean;
          message: string;
          reason: string;
        };
        if (payload.available) {
          setSlugStatus({ tone: 'ok', message: payload.message });
          return;
        }
        setSlugStatus({
          tone: payload.reason === 'invalid' || payload.reason === 'taken' ? 'warn' : 'error',
          message: payload.message,
        });
      } catch {
        setSlugStatus({ tone: 'error', message: 'Could not check slug right now.' });
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [slug]);

  const passwordStrength = useMemo(
    () => (password.length > 0 ? zxcvbn(password) : null),
    [password],
  );

  const passwordsMismatch =
    passwordConfirm.length > 0 && password.length > 0 && password !== passwordConfirm;
  const passwordTooShort = password.length > 0 && password.length < 8;
  const canSubmit =
    acceptedTerms &&
    displayName.length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    passwordConfirm.length >= 8 &&
    !passwordsMismatch;

  useEffect(() => {
    setStepError(null);
  }, [firstName, lastName, email, password, passwordConfirm, acceptedTerms]);

  function validateAccountStep(): string | null {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      return 'First name, last name, and email are required.';
    }
    return null;
  }

  function validateFinalStep(): string | null {
    const accountError = validateAccountStep();
    if (accountError) return accountError;
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (password !== passwordConfirm) {
      return 'Passwords do not match.';
    }
    if (!acceptedTerms) {
      return 'Accept the Terms of Service and Privacy Policy to continue.';
    }
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step !== 2) {
      event.preventDefault();
      return;
    }

    const validationError = validateFinalStep();
    if (validationError) {
      event.preventDefault();
      setStepError(validationError);
    }
  }

  function goNext() {
    if (step === 0) {
      if (!businessName.trim() || !slug.trim()) return;
      if (slugStatus.tone === 'warn' || slugStatus.tone === 'error') return;
    }
    if (step === 1) {
      const validationError = validateAccountStep();
      if (validationError) {
        setStepError(validationError);
        return;
      }
    }
    setStepError(null);
    if (step < 2) setStep((prev) => prev + 1);
  }

  function goBack() {
    setStepError(null);
    if (step > 0) setStep((prev) => prev - 1);
  }

  return (
    <form action={formAction} className={styles.form} onSubmit={handleSubmit} noValidate>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.steps} aria-label="Trial setup progress">
        <span data-active={step === 0 || undefined}>1. Workspace</span>
        <span data-active={step === 1 || undefined}>2. Your details</span>
        <span data-active={step === 2 || undefined}>3. Password</span>
      </div>

      <section
        hidden={step !== 0}
        inert={step !== 0}
        aria-hidden={step !== 0}
        className={
          step === 0 ? styles.stepSection : `${styles.stepSection} ${styles.stepSectionHidden}`
        }
      >
        <p className={styles.stepHint}>
          Name your business and pick a workspace URL. You can add service area and team size after
          signup.
        </p>

        <label className={styles.label} htmlFor="business_name">
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          className={styles.input}
          required
          placeholder="Acme Cleaning Co"
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
        />

        <label className={styles.label} htmlFor="workspace_slug">
          Workspace slug
        </label>
        <div className={styles.slugRow}>
          <input
            id="workspace_slug"
            name="workspace_slug"
            className={styles.input}
            required
            pattern="^[a-z0-9][a-z0-9\\-]{1,61}[a-z0-9]$"
            placeholder="acme"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <span className={styles.slugSuffix}>.{domainSuffix}</span>
        </div>
        <p className={styles.slugStatus} data-tone={slugStatus.tone}>
          {slugStatus.message}
        </p>
      </section>

      <section
        hidden={step !== 1}
        inert={step !== 1}
        aria-hidden={step !== 1}
        className={
          step === 1 ? styles.stepSection : `${styles.stepSection} ${styles.stepSectionHidden}`
        }
      >
        <p className={styles.stepHint}>
          Your 7-day free trial includes scheduling, quotes, customers, and invoicing. Choose a paid
          plan when you are ready — no credit card required today.{' '}
          <Link href="/pricing" target="_blank" rel="noopener noreferrer">
            Compare plans
          </Link>
        </p>

        <div className={styles.nameRow}>
          <div className={styles.nameField}>
            <label className={styles.label} htmlFor="first_name">
              First name
            </label>
            <input
              id="first_name"
              name="first_name"
              className={styles.input}
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className={styles.nameField}>
            <label className={styles.label} htmlFor="last_name">
              Last name
            </label>
            <input
              id="last_name"
              name="last_name"
              className={styles.input}
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>

        <label className={styles.label} htmlFor="email">
          Owner email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={styles.input}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className={styles.label} htmlFor="owner_phone">
          Owner phone <span className={styles.optional}>(optional)</span>
        </label>
        <input
          id="owner_phone"
          name="owner_phone"
          type="tel"
          autoComplete="tel"
          className={styles.input}
          placeholder="(555) 555-5555"
          value={ownerPhone}
          onChange={(event) => setOwnerPhone(event.target.value)}
        />

        <label className={styles.label} htmlFor="business_type">
          Business type
        </label>
        <select
          id="business_type"
          name="business_type"
          className={styles.input}
          value={businessType}
          onChange={(event) => setBusinessType(event.target.value)}
        >
          <option value="residential">Residential cleaning</option>
          <option value="commercial">Commercial cleaning</option>
          <option value="both">Both residential and commercial</option>
        </select>

        {stepError ? (
          <p className={styles.stepFieldError} role="alert">
            {stepError}
          </p>
        ) : null}
      </section>

      <section
        hidden={step !== 2}
        inert={step !== 2}
        aria-hidden={step !== 2}
        className={
          step === 2 ? styles.stepSection : `${styles.stepSection} ${styles.stepSectionHidden}`
        }
      >
        <p className={styles.stepHint}>
          Create a password for {email.trim() || 'your account'}. You will use this email and
          password to sign in to your workspace.
        </p>

        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={[styles.input, passwordsMismatch ? styles.inputInvalid : '']
            .filter(Boolean)
            .join(' ')}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={passwordsMismatch || passwordTooShort || undefined}
          aria-describedby={
            [
              passwordStrength ? 'password-strength-hint' : null,
              passwordsMismatch ? 'password_confirm_error' : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />

        {passwordStrength ? (
          <div
            id="password-strength-hint"
            className={styles.strengthBlock}
            aria-live="polite"
            aria-label="Password strength feedback"
          >
            <div className={styles.strengthHeader}>
              <span
                className={styles.strengthLabel}
                data-tone={passwordStrengthTone(passwordStrength.score)}
              >
                {passwordStrengthLabel(passwordStrength.score)}
              </span>
              <span className={styles.strengthCrackHint}>
                ~{String(passwordStrength.crack_times_display.offline_slow_hashing_1e4_per_second)}{' '}
                to crack
              </span>
            </div>
            <div
              className={styles.strengthMeter}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={passwordStrength.score}
              aria-valuetext={passwordStrengthLabel(passwordStrength.score)}
            >
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={`strength-seg-${index}`}
                  className={styles.strengthSegment}
                  data-filled={index < passwordStrength.score ? 'true' : undefined}
                  data-tone={passwordStrengthTone(passwordStrength.score)}
                />
              ))}
            </div>
            {formatPasswordFeedback(passwordStrength) ? (
              <p className={styles.strengthFeedback}>{formatPasswordFeedback(passwordStrength)}</p>
            ) : null}
          </div>
        ) : null}

        <label className={styles.label} htmlFor="password_confirm">
          Confirm password
        </label>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={[styles.input, passwordsMismatch ? styles.inputInvalid : '']
            .filter(Boolean)
            .join(' ')}
          required
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          aria-invalid={passwordsMismatch || undefined}
          aria-describedby={passwordsMismatch ? 'password_confirm_error' : undefined}
        />
        {passwordsMismatch ? (
          <p id="password_confirm_error" className={styles.fieldError} role="alert">
            Passwords do not match.
          </p>
        ) : null}

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            name="accept_terms"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            required
          />
          <span>
            I agree to start a 7-day free trial and accept the{' '}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {stepError ? (
          <p className={styles.stepFieldError} role="alert">
            {stepError}
          </p>
        ) : null}
      </section>

      <div className={styles.actions}>
        {step > 0 ? (
          <button type="button" className={styles.backButton} onClick={goBack}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <button type="button" className={styles.submit} onClick={goNext}>
            Continue
          </button>
        ) : (
          <button type="submit" className={styles.submit} disabled={pending || !canSubmit}>
            {pending ? 'Creating workspace...' : 'Start free trial'}
          </button>
        )}
      </div>
    </form>
  );
}
