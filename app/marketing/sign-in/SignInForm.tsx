'use client';

import { useActionState } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  requestMagicLink,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  type SignInState,
} from './actions';
import styles from './sign-in.module.scss';

const initialState: SignInState = {};

type AuthMode = 'password' | 'magic' | 'signup';

export function SignInForm({ nextPath }: { nextPath: string }) {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [mode, setMode] = useState<AuthMode>('password');
  const [returnOrigin, setReturnOrigin] = useState('');

  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(signUpWithPassword, initialState);
  const [magicState, magicAction, magicPending] = useActionState(requestMagicLink, initialState);

  useEffect(() => {
    setReturnOrigin(window.location.origin);
  }, []);

  const activePasswordError =
    mode === 'password' ? passwordState.error : mode === 'signup' ? signupState.error : undefined;
  const activePasswordSuccess =
    mode === 'password' ? undefined : mode === 'signup' ? signupState.success : undefined;

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'password'}
          className={styles.tab}
          data-active={mode === 'password' || undefined}
          onClick={() => setMode('password')}
        >
          Email & password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'magic'}
          className={styles.tab}
          data-active={mode === 'magic' || undefined}
          onClick={() => setMode('magic')}
        >
          Magic link
        </button>
      </div>

      {(urlError || activePasswordError) && (
        <p className={styles.error} role="alert">
          {activePasswordError ?? urlError}
        </p>
      )}

      {activePasswordSuccess ? (
        <p className={styles.success}>{activePasswordSuccess}</p>
      ) : null}

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
          <button
            type="button"
            className={styles.switchMode}
            onClick={() => setMode('signup')}
          >
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

      {mode === 'magic' ? (
        <form className={styles.form} action={magicAction}>
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="return_origin" value={returnOrigin} />
          <p className={styles.hint}>
            Magic links are convenient but rely on email delivery limits from your auth provider. Use
            email/password or Google for frequent testing.
          </p>
          <label className={styles.label} htmlFor="magic-email">
            Email
          </label>
          <input
            id="magic-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className={styles.input}
          />
          <button type="submit" className={styles.submit} disabled={magicPending}>
            {magicPending ? 'Sending secure link...' : 'Send magic link'}
          </button>
          {magicState.error ? <p className={styles.error}>{magicState.error}</p> : null}
          {magicState.success ? <p className={styles.success}>{magicState.success}</p> : null}
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
