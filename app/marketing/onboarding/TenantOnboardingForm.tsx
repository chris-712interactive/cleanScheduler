'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { createTenantAndOwner, type TenantOnboardingState } from './actions';
import styles from './onboarding.module.scss';

const initialState: TenantOnboardingState = {};

export function TenantOnboardingForm({ domainSuffix }: { domainSuffix: string }) {
  const [state, formAction, pending] = useActionState(createTenantAndOwner, initialState);
  const [slug, setSlug] = useState('');
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

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <label className={styles.label} htmlFor="business_name">
        Business name
      </label>
      <input
        id="business_name"
        name="business_name"
        className={styles.input}
        required
        placeholder="Acme Cleaning Co"
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

      <label className={styles.label} htmlFor="display_name">
        Your name
      </label>
      <input id="display_name" name="display_name" className={styles.input} required />

      <label className={styles.label} htmlFor="email">
        Work email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        className={styles.input}
        required
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
      />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Creating workspace...' : 'Create workspace'}
      </button>
    </form>
  );
}
