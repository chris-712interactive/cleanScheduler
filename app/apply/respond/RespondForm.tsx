'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  confirmRespondAction,
  declineRespondAction,
  withdrawRespondAction,
  type RespondState,
} from './actions';
import styles from '../apply.module.scss';

const initial: RespondState = {};

export function RespondForm({ token, purpose }: { token: string; purpose: string }) {
  const action =
    purpose === 'decline'
      ? declineRespondAction
      : purpose === 'withdraw'
        ? withdrawRespondAction
        : confirmRespondAction;
  const [state, formAction, pending] = useActionState(action, initial);
  if (state.success) return <p className={styles.success}>{state.success}</p>;
  const label =
    purpose === 'decline'
      ? 'Decline this time'
      : purpose === 'withdraw'
        ? 'Withdraw application'
        : 'Confirm this time';
  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="token" value={token} />
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      <Button
        type="submit"
        variant={purpose === 'confirm' ? 'primary' : 'secondary'}
        disabled={pending}
      >
        {pending ? 'Saving…' : label}
      </Button>
    </form>
  );
}
