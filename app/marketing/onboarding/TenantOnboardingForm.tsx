'use client';

import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActionState } from 'react';
import zxcvbn from 'zxcvbn';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { fireSlugAvailableConfetti } from '@/lib/ui/slugAvailableConfetti';
import { createTenantAndOwner, type TenantOnboardingState } from './actions';
import {
  formatPasswordFeedback,
  passwordStrengthLabel,
  passwordStrengthTone,
} from './passwordStrength';
import styles from './onboarding.module.scss';

const initialState: TenantOnboardingState = {};

const SLUG_CHECK_DEBOUNCE_MS = 500;
const SLUG_CONFETTI_DEBOUNCE_MS = 600;

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
    tone: 'idle' | 'checking' | 'ok' | 'warn' | 'error';
    message: string;
  }>({ tone: 'idle', message: 'Choose a unique slug for your workspace URL.' });
  const celebratedSlugRef = useRef<string | null>(null);

  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

  useEffect(() => {
    if (slugStatus.tone !== 'ok') return;

    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) return;

    const timeout = setTimeout(() => {
      if (celebratedSlugRef.current === normalizedSlug) return;
      celebratedSlugRef.current = normalizedSlug;
      void fireSlugAvailableConfetti();
    }, SLUG_CONFETTI_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [slug, slugStatus.tone]);

  useEffect(() => {
    if (!slug.trim()) {
      setSlugStatus({ tone: 'idle', message: 'Choose a unique slug for your workspace URL.' });
      return;
    }

    setSlugStatus({ tone: 'idle', message: 'Checking availability…' });

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSlugStatus({ tone: 'checking', message: 'Checking availability…' });

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
    }, SLUG_CHECK_DEBOUNCE_MS);

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

  const workspaceStepBlocked = !businessName.trim() || !slug.trim() || slugStatus.tone !== 'ok';

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
      if (!businessName.trim() || !slug.trim() || slugStatus.tone !== 'ok') return;
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
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success">
          {state.success}
          {state.signInUrl ? (
            <>
              {' '}
              <Link href={state.signInUrl}>Open workspace sign-in</Link>
            </>
          ) : null}
        </Alert>
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

        <FormField label="Business name" htmlFor="business_name">
          <Input
            id="business_name"
            name="business_name"
            required
            placeholder="Acme Cleaning Co"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
          />
        </FormField>

        <FormField label="Workspace slug" htmlFor="workspace_slug">
          <div className={styles.slugField} data-tone={slugStatus.tone}>
            <div className={styles.slugRow}>
              <Input
                id="workspace_slug"
                name="workspace_slug"
                required
                pattern="^[a-z0-9][a-z0-9\\-]{1,61}[a-z0-9]$"
                placeholder="acme"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                invalid={slugStatus.tone === 'warn' || slugStatus.tone === 'error'}
                aria-describedby="workspace_slug_status"
                aria-busy={slugStatus.tone === 'checking' || undefined}
              />
              <span className={styles.slugSuffix}>.{domainSuffix}</span>
            </div>
            <p
              id="workspace_slug_status"
              className={styles.slugStatus}
              data-tone={slugStatus.tone}
              aria-live="polite"
            >
              {slugStatus.tone === 'checking' ? (
                <Loader2 size={16} className={styles.slugStatusIcon} aria-hidden="true" />
              ) : null}
              {slugStatus.tone === 'ok' ? (
                <CheckCircle2 size={16} className={styles.slugStatusIcon} aria-hidden="true" />
              ) : null}
              {slugStatus.tone === 'warn' || slugStatus.tone === 'error' ? (
                <XCircle size={16} className={styles.slugStatusIcon} aria-hidden="true" />
              ) : null}
              <span>{slugStatus.message}</span>
            </p>
          </div>
        </FormField>
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
          <FormField label="First name" htmlFor="first_name" className={styles.nameField}>
            <Input
              id="first_name"
              name="first_name"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="last_name" className={styles.nameField}>
            <Input
              id="last_name"
              name="last_name"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Owner email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>

        <FormField label="Owner phone" htmlFor="owner_phone" optional>
          <Input
            id="owner_phone"
            name="owner_phone"
            type="tel"
            autoComplete="tel"
            placeholder="(555) 555-5555"
            value={ownerPhone}
            onChange={(event) => setOwnerPhone(event.target.value)}
          />
        </FormField>

        <FormField label="Business type" htmlFor="business_type">
          <Select
            id="business_type"
            name="business_type"
            value={businessType}
            onChange={(event) => setBusinessType(event.target.value)}
          >
            <option value="residential">Residential cleaning</option>
            <option value="commercial">Commercial cleaning</option>
            <option value="both">Both residential and commercial</option>
          </Select>
        </FormField>

        {stepError ? <Alert>{stepError}</Alert> : null}
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

        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={passwordsMismatch || passwordTooShort}
            aria-describedby={
              [
                passwordStrength ? 'password-strength-hint' : null,
                passwordsMismatch ? 'password_confirm-error' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
          />
        </FormField>

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

        <FormField
          label="Confirm password"
          htmlFor="password_confirm"
          error={passwordsMismatch ? 'Passwords do not match.' : undefined}
        >
          <Input
            id="password_confirm"
            name="password_confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            invalid={passwordsMismatch}
          />
        </FormField>

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

        {stepError ? <Alert>{stepError}</Alert> : null}
      </section>

      <div className={styles.actions}>
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={goBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button type="button" onClick={goNext} disabled={step === 0 && workspaceStepBlocked}>
            Continue
          </Button>
        ) : (
          <Button type="submit" loading={pending} disabled={!canSubmit}>
            {pending ? 'Creating workspace...' : 'Start free trial'}
          </Button>
        )}
      </div>
    </form>
  );
}
