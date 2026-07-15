'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { startGuestInvoicePayCheckoutAction } from './actions';
import styles from './pay.module.scss';

export function GuestPayCheckoutButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={styles.form}
      action={(formData) => {
        startTransition(() => {
          void startGuestInvoicePayCheckoutAction(formData);
        });
      }}
    >
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Starting checkout…' : 'Pay with card'}
      </Button>
    </form>
  );
}
