'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { updateTenantCustomer, type CustomerFormState } from './actions';
import styles from './customers.module.scss';

const initial: CustomerFormState = {};

export interface CustomerEditSnapshot {
  customerId: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
}

export function CustomerEditForm({
  tenantSlug,
  snapshot,
}: {
  tenantSlug: string;
  snapshot: CustomerEditSnapshot;
}) {
  const [state, formAction, pending] = useActionState(updateTenantCustomer, initial);
  useRefreshOnServerActionSuccess(state.success);

  return (
    <form action={formAction} className={styles.form} key={snapshot.customerId}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={snapshot.customerId} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Changes saved.
        </p>
      ) : null}

      <label className={styles.label} htmlFor="edit_full_name">
        Full name
      </label>
      <input
        id="edit_full_name"
        name="full_name"
        className={styles.input}
        required
        defaultValue={snapshot.fullName}
      />

      <label className={styles.label} htmlFor="edit_email">
        Email
      </label>
      <input
        id="edit_email"
        name="email"
        type="email"
        className={styles.input}
        defaultValue={snapshot.email}
      />

      <label className={styles.label} htmlFor="edit_phone">
        Phone
      </label>
      <input id="edit_phone" name="phone" type="tel" className={styles.input} defaultValue={snapshot.phone} />

      <label className={styles.label} htmlFor="edit_status">
        Status
      </label>
      <select
        id="edit_status"
        name="status"
        className={styles.input}
        defaultValue={snapshot.status === 'inactive' ? 'inactive' : 'active'}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
