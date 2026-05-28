'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { updatePasswordAfterReset, type ResetPasswordState } from './actions';
import styles from '../sign-in/sign-in.module.scss';

const initialState: ResetPasswordState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAfterReset, initialState);

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="reset-password">
        <span>New password</span>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={styles.input}
        />
      </label>
      <label className={styles.label} htmlFor="reset-password-confirm">
        <span>Confirm password</span>
        <input
          id="reset-password-confirm"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={styles.input}
        />
      </label>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Update password'}
      </button>
      <p className={styles.helpText}>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
