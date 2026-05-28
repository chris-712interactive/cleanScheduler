'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { requestPasswordReset, type ForgotPasswordState } from './actions';
import styles from '../sign-in/sign-in.module.scss';

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [returnOrigin, setReturnOrigin] = useState('');
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  useEffect(() => {
    setReturnOrigin(window.location.origin);
  }, []);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="return_origin" value={returnOrigin} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          {state.success}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="forgot-email">
        <span>Email</span>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={styles.input}
        />
      </label>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <p className={styles.helpText}>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
