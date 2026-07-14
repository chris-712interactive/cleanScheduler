'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
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
      {(urlError || activeError) && <Alert>{activeError ?? urlError}</Alert>}

      <form className={styles.form} action={passwordAction}>
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="return_origin" value={returnOrigin} />
        <FormField label="Email" htmlFor="pw-email">
          <Input
            id="pw-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={defaultEmail ?? ''}
            placeholder="you@company.com"
          />
        </FormField>
        <FormField label="Password" htmlFor="pw-password">
          <Input
            id="pw-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </FormField>
        <Button type="submit" fullWidth loading={passwordPending}>
          {passwordPending ? 'Signing in...' : 'Sign in'}
        </Button>
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
        <Button type="submit" variant="secondary" fullWidth>
          Continue with Google
        </Button>
      </form>
    </div>
  );
}
