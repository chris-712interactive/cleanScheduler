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
  companyName: string;
  serviceAddressLine1: string;
  serviceAddressLine2: string;
  serviceCity: string;
  serviceState: string;
  servicePostalCode: string;
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

      <label className={styles.label} htmlFor="edit_company_name">
        Company name (optional)
      </label>
      <input
        id="edit_company_name"
        name="company_name"
        className={styles.input}
        defaultValue={snapshot.companyName}
      />

      <label className={styles.label} htmlFor="edit_service_address_line1">
        Service address line 1
      </label>
      <input
        id="edit_service_address_line1"
        name="service_address_line1"
        className={styles.input}
        defaultValue={snapshot.serviceAddressLine1}
      />

      <label className={styles.label} htmlFor="edit_service_address_line2">
        Service address line 2 (optional)
      </label>
      <input
        id="edit_service_address_line2"
        name="service_address_line2"
        className={styles.input}
        defaultValue={snapshot.serviceAddressLine2}
      />

      <label className={styles.label} htmlFor="edit_service_city">
        City
      </label>
      <input
        id="edit_service_city"
        name="service_city"
        className={styles.input}
        defaultValue={snapshot.serviceCity}
      />

      <label className={styles.label} htmlFor="edit_service_state">
        State / region
      </label>
      <input
        id="edit_service_state"
        name="service_state"
        className={styles.input}
        defaultValue={snapshot.serviceState}
      />

      <label className={styles.label} htmlFor="edit_service_postal_code">
        Postal code
      </label>
      <input
        id="edit_service_postal_code"
        name="service_postal_code"
        className={styles.input}
        defaultValue={snapshot.servicePostalCode}
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
