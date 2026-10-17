'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { requestPasswordReset, type ForgotPasswordState } from './actions';
import styles from '../sign-in/sign-in.module.scss';

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [returnOrigin, setReturnOrigin] = useState('');
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  useFeedbackToast({ error: state.error, success: state.success, pending });

  useEffect(() => {
    setReturnOrigin(window.location.origin);
  }, []);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="return_origin" value={returnOrigin} />
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
