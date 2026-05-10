'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { createTenantAndOwner, type TenantOnboardingState } from './actions';
import styles from './onboarding.module.scss';

const initialState: TenantOnboardingState = {};

export function TenantOnboardingForm({ domainSuffix }: { domainSuffix: string }) {
  const [state, formAction, pending] = useActionState(createTenantAndOwner, initialState);
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [businessType, setBusinessType] = useState('residential');
  const [displayName, setDisplayName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    tone: 'idle' | 'ok' | 'warn' | 'error';
    message: string;
  }>({ tone: 'idle', message: 'Choose a unique slug for your workspace URL.' });

  useEffect(() => {
    if (!slug.trim()) {
      setSlugStatus({ tone: 'idle', message: 'Choose a unique slug for your workspace URL.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/onboarding/slug-availability?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        });
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

  function goNext() {
    if (step === 0) {
      if (!businessName.trim() || !slug.trim() || !teamSize || !serviceArea.trim()) return;
      if (slugStatus.tone === 'warn' || slugStatus.tone === 'error') return;
    }
    if (step === 1) {
      if (!displayName.trim() || !email.trim() || password.length < 8) return;
    }
    if (step < 2) setStep((prev) => prev + 1);
  }

  function goBack() {
    if (step > 0) setStep((prev) => prev - 1);
  }

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.steps} aria-label="Trial setup progress">
        <span data-active={step === 0 || undefined}>1. Company</span>
        <span data-active={step === 1 || undefined}>2. Owner account</span>
        <span data-active={step === 2 || undefined}>3. Preferences</span>
      </div>

      <section hidden={step !== 0} className={styles.stepSection}>
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

        <label className={styles.label} htmlFor="service_area">
          Primary service area
        </label>
        <input
          id="service_area"
          name="service_area"
          className={styles.input}
          placeholder="Charlotte, NC metro"
          required
          value={serviceArea}
          onChange={(event) => setServiceArea(event.target.value)}
        />

        <label className={styles.label} htmlFor="team_size">
          Team size
        </label>
        <select
          id="team_size"
          name="team_size"
          className={styles.input}
          required
          value={teamSize}
          onChange={(event) => setTeamSize(event.target.value)}
        >
          <option value="">Select team size</option>
          <option value="solo">Just me</option>
          <option value="2-5">2-5 staff</option>
          <option value="6-15">6-15 staff</option>
          <option value="16-40">16-40 staff</option>
          <option value="40+">40+ staff</option>
        </select>
      </section>

      <section hidden={step !== 1} className={styles.stepSection}>
        <label className={styles.label} htmlFor="display_name">
          Your full name
        </label>
        <input
          id="display_name"
          name="display_name"
          className={styles.input}
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />

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
          Owner phone
        </label>
        <input
          id="owner_phone"
          name="owner_phone"
          type="tel"
          className={styles.input}
          placeholder="(555) 555-5555"
          value={ownerPhone}
          onChange={(event) => setOwnerPhone(event.target.value)}
        />

        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={styles.input}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </section>

      <section hidden={step !== 2} className={styles.stepSection}>
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

        <label className={styles.label} htmlFor="company_email">
          Company support email
        </label>
        <input
          id="company_email"
          name="company_email"
          type="email"
          className={styles.input}
          placeholder="support@acmecleaning.com"
          value={companyEmail}
          onChange={(event) => setCompanyEmail(event.target.value)}
        />

        <label className={styles.label} htmlFor="company_phone">
          Company phone
        </label>
        <input
          id="company_phone"
          name="company_phone"
          type="tel"
          className={styles.input}
          placeholder="(555) 555-0123"
          value={companyPhone}
          onChange={(event) => setCompanyPhone(event.target.value)}
        />

        <label className={styles.label} htmlFor="company_website">
          Company website
        </label>
        <input
          id="company_website"
          name="company_website"
          type="url"
          className={styles.input}
          placeholder="https://www.acmecleaning.com"
          value={companyWebsite}
          onChange={(event) => setCompanyWebsite(event.target.value)}
        />

        <label className={styles.label} htmlFor="referral_source">
          How did you hear about us?
        </label>
        <input
          id="referral_source"
          name="referral_source"
          className={styles.input}
          placeholder="Google, referral, podcast..."
          value={referralSource}
          onChange={(event) => setReferralSource(event.target.value)}
        />

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            name="accept_terms"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            required
          />
          <span>I agree to start a 7-day trial and accept the terms.</span>
        </label>
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
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Creating workspace...' : 'Start free trial'}
          </button>
        )}
      </div>
    </form>
  );
}
