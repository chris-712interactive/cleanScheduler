'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { endMasqueradeAction } from '@/lib/admin/masqueradeActions';
import styles from './MasqueradeExitBanner.module.scss';

const initial: { error?: string } = {};

export function MasqueradeExitBanner() {
  const [state, action, pending] = useActionState(endMasqueradeAction, initial);
  return (
    <form action={action} className={styles.form}>
      <span>You are viewing this workspace as platform staff (masquerade).</span>
      {state.error ? (
        <span className={styles.error} role="alert">
          {state.error}
        </span>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? 'Exiting…' : 'Exit to founder admin'}
      </Button>
    </form>
  );
}
