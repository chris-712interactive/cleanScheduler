'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
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
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <FormField label="Email" htmlFor="forgot-email">
        <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <Button type="submit" fullWidth loading={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
      <p className={styles.helpText}>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
