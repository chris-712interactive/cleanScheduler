'use client';

import { useActionState } from 'react';
import { useEffect, useState } from 'react';
import { requestMagicLink, type SignInState } from './actions';
import styles from './sign-in.module.scss';

const initialState: SignInState = {};

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(requestMagicLink, initialState);
  const [returnOrigin, setReturnOrigin] = useState('');

  useEffect(() => {
    setReturnOrigin(window.location.origin);
  }, []);

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="return_origin" value={returnOrigin} />
      <label className={styles.label} htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@company.com"
        className={styles.input}
      />
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Sending secure link...' : 'Send magic link'}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}
    </form>
  );
}
