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
        <span>Service type (optional)</span>
        <select name="service_interest" defaultValue="" disabled={pending}>
          <option value="">Select a service</option>
          <option value="Standard clean">Standard clean</option>
          <option value="Deep clean">Deep clean</option>
          <option value="Move-in / move-out">Move-in / move-out</option>
          <option value="Office / commercial">Office / commercial</option>
          <option value="Recurring service">Recurring service</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Preferred time (optional)</span>
        <select name="preferred_time_window" defaultValue="" disabled={pending}>
          <option value="">Flexible</option>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="evening">Evening</option>
          <option value="flexible">Flexible</option>
        </select>
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
