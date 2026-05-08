'use client';

import { useActionState } from 'react';
import { requestMagicLink, type SignInState } from './actions';
import styles from './sign-in.module.scss';

const initialState: SignInState = {};

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(requestMagicLink, initialState);

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="next" value={nextPath} />
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
