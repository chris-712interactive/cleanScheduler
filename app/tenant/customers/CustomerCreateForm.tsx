'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { createTenantCustomer, type CustomerFormState } from './actions';
import styles from './customers.module.scss';

const initial: CustomerFormState = {};

export function CustomerCreateForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(createTenantCustomer, initial);
  useRefreshOnServerActionSuccess(state.success);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Customer added.
        </p>
      ) : null}

      <label className={styles.label} htmlFor="full_name">
        Full name
      </label>
      <input
        id="full_name"
        name="full_name"
        className={styles.input}
        required
        placeholder="Jane Customer"
      />

      <label className={styles.label} htmlFor="email">
        Email
      </label>
      <input id="email" name="email" type="email" className={styles.input} placeholder="jane@email.com" />

      <label className={styles.label} htmlFor="phone">
        Phone
      </label>
      <input id="phone" name="phone" type="tel" className={styles.input} placeholder="(555) 555-5555" />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Add customer'}
      </button>
    </form>
  );
}
