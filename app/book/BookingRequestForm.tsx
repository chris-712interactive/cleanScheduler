'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { submitBookingRequestAction, type BookingRequestActionState } from './actions';
import styles from './book.module.scss';

const initial: BookingRequestActionState = {};

export function BookingRequestForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(submitBookingRequestAction, initial);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Thanks — we received your request and will follow up soon.
        </p>
      ) : null}

      <label className={styles.field}>
        <span>Name</span>
        <input type="text" name="name" required autoComplete="name" disabled={pending} />
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input type="email" name="email" required autoComplete="email" disabled={pending} />
      </label>
      <label className={styles.field}>
        <span>Phone</span>
        <input type="tel" name="phone" autoComplete="tel" disabled={pending} />
      </label>
      <label className={styles.field}>
        <span>Service address</span>
        <input type="text" name="address_line1" autoComplete="street-address" disabled={pending} />
      </label>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>City</span>
          <input type="text" name="city" autoComplete="address-level2" disabled={pending} />
        </label>
        <label className={styles.field}>
          <span>State</span>
          <input type="text" name="state" autoComplete="address-level1" disabled={pending} />
        </label>
        <label className={styles.field}>
          <span>ZIP</span>
          <input type="text" name="postal_code" autoComplete="postal-code" disabled={pending} />
        </label>
      </div>
      <label className={styles.field}>
        <span>Preferred date (optional)</span>
        <input type="date" name="preferred_date" disabled={pending} />
      </label>
      <label className={styles.field}>
        <span>How can we help?</span>
        <textarea name="message" rows={4} required disabled={pending} />
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Sending…' : 'Request a quote'}
      </Button>
    </form>
  );
}
