'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { updateTenantCustomer, type CustomerFormState } from './actions';
import styles from './customers.module.scss';

const initial: CustomerFormState = {};

export interface CustomerEditSnapshot {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  companyName: string;
  preferredContactMethod: string;
  internalNotes: string;
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

      <label className={styles.label} htmlFor="edit_first_name">
        First name
      </label>
      <input
        id="edit_first_name"
        name="first_name"
        className={styles.input}
        required
        autoComplete="given-name"
        defaultValue={snapshot.firstName}
      />

      <label className={styles.label} htmlFor="edit_last_name">
        Last name (optional)
      </label>
      <input
        id="edit_last_name"
        name="last_name"
        className={styles.input}
        autoComplete="family-name"
        defaultValue={snapshot.lastName}
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
      <input
        id="edit_phone"
        name="phone"
        type="tel"
        className={styles.input}
        defaultValue={snapshot.phone}
      />

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

      <label className={styles.label} htmlFor="edit_company_name">
        Company name (optional)
      </label>
      <input
        id="edit_company_name"
        name="company_name"
        className={styles.input}
        defaultValue={snapshot.companyName}
      />

      <label className={styles.label} htmlFor="edit_preferred_contact_method">
        Preferred contact
      </label>
      <select
        id="edit_preferred_contact_method"
        name="preferred_contact_method"
        className={styles.input}
        defaultValue={snapshot.preferredContactMethod}
      >
        <option value="">— Unspecified —</option>
        <option value="email">Email</option>
        <option value="phone">Phone</option>
        <option value="sms">SMS</option>
      </select>

      <label className={styles.label} htmlFor="edit_internal_notes">
        Internal notes
      </label>
      <textarea
        id="edit_internal_notes"
        name="internal_notes"
        className={styles.textarea}
        defaultValue={snapshot.internalNotes}
      />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
