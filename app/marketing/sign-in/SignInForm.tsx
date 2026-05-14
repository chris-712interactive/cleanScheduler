'use client';

import { useActionState } from 'react';
import { useEffect, useState } from 'react';
import {
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  type SignInState,
} from './actions';
import styles from './sign-in.module.scss';

const initialState: SignInState = {};

type AuthMode = 'password' | 'signup';

export function SignInForm({
  nextPath,
  urlError,
}: {
  nextPath: string;
  /** Auth failures only (wrong password, OAuth). Authorization issues use /access-denied. */
  urlError?: string | null;
}) {
  const [mode, setMode] = useState<AuthMode>('password');
  const [returnOrigin, setReturnOrigin] = useState('');

  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signUpWithPassword,
    initialState,
  );

  useEffect(() => {
    setReturnOrigin(window.location.origin);
  }, []);

  const activeError = mode === 'password' ? passwordState.error : signupState.error;
  const activeSuccess = mode === 'signup' ? signupState.success : undefined;

  return (
    <div className={styles.wrapper}>
      {(urlError || activeError) && (
        <p className={styles.error} role="alert">
          {activeError ?? urlError}
        </p>
      )}

      {activeSuccess ? <p className={styles.success}>{activeSuccess}</p> : null}

      {mode === 'password' ? (
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
          <button type="button" className={styles.switchMode} onClick={() => setMode('signup')}>
            Need an account? Create one
          </button>
        </form>
      ) : null}

      {mode === 'signup' ? (
        <form className={styles.form} action={signupAction}>
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="return_origin" value={returnOrigin} />
          <label className={styles.label} htmlFor="su-email">
            Email
          </label>
          <input
            id="su-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className={styles.input}
          />
          <label className={styles.label} htmlFor="su-password">
            Password
          </label>
          <input
            id="su-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className={styles.input}
          />
          <label className={styles.label} htmlFor="su-confirm">
            Confirm password
          </label>
          <input
            id="su-confirm"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Repeat password"
            className={styles.input}
          />
          <button type="submit" className={styles.submit} disabled={signupPending}>
            {signupPending ? 'Creating account...' : 'Create account'}
          </button>
          <button type="button" className={styles.switchMode} onClick={() => setMode('password')}>
            Already have an account? Sign in
          </button>
        </form>
      ) : null}

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
