'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { signInWithGoogle, signInWithPassword, type SignInState } from './actions';
import styles from './sign-in.module.scss';

const initialState: SignInState = {};

export function SignInForm({
  nextPath,
  urlError,
  defaultEmail,
}: {
  nextPath: string;
  /** Auth failures only (wrong password, OAuth). Authorization issues use /access-denied. */
  urlError?: string | null;
  defaultEmail?: string;
}) {
  const [returnOrigin, setReturnOrigin] = useState('');

  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialState,
  );

  useEffect(() => {
    setReturnOrigin(window.location.origin);
  }, []);

  const activeError = passwordState.error;

  return (
    <div className={styles.wrapper}>
      {(urlError || activeError) && (
        <p className={styles.error} role="alert">
          {activeError ?? urlError}
        </p>
      )}

      <form className={styles.form} action={passwordAction}>
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="return_origin" value={returnOrigin} />
        <label className={styles.label} htmlFor="pw-email">
          Email
        </label>
        <input
          id="pw-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail ?? ''}
          placeholder="you@company.com"
          className={styles.input}
        />
        <label className={styles.label} htmlFor="pw-password">
          Password
        </label>
        <input
          id="pw-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className={styles.input}
        />
        <button type="submit" className={styles.submit} disabled={passwordPending}>
          {passwordPending ? 'Signing in...' : 'Sign in'}
        </button>
        <p className={styles.helpText}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </form>

      <p className={styles.trialPrompt}>
        New to Clean Scheduler?{' '}
        <Link href="/start-trial" className={styles.trialLink}>
          Start your free trial
        </Link>{' '}
        to create a workspace — sign-in alone does not set up a business account.
      </p>

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <form className={styles.googleForm} action={signInWithGoogle}>
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="return_origin" value={returnOrigin} />
        <button type="submit" className={styles.googleButton}>
          Continue with Google
        </button>
      </form>
    </div>
  );
}
