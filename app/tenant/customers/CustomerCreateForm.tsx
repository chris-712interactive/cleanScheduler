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

      <label className={styles.label} htmlFor="company_name">
        Company name (optional)
      </label>
      <input id="company_name" name="company_name" className={styles.input} placeholder="Acme Property Mgmt" />

      <label className={styles.label} htmlFor="service_address_line1">
        Service address line 1
      </label>
      <input id="service_address_line1" name="service_address_line1" className={styles.input} placeholder="123 Main St" />

      <label className={styles.label} htmlFor="service_address_line2">
        Service address line 2 (optional)
      </label>
      <input id="service_address_line2" name="service_address_line2" className={styles.input} placeholder="Unit 5B" />

      <label className={styles.label} htmlFor="service_city">
        City
      </label>
      <input id="service_city" name="service_city" className={styles.input} placeholder="Nashville" />

      <label className={styles.label} htmlFor="service_state">
        State / region
      </label>
      <input id="service_state" name="service_state" className={styles.input} placeholder="TN" />

      <label className={styles.label} htmlFor="service_postal_code">
        Postal code
      </label>
      <input id="service_postal_code" name="service_postal_code" className={styles.input} placeholder="37203" />

      <label className={styles.label} htmlFor="preferred_contact_method">
        Preferred contact
      </label>
      <select id="preferred_contact_method" name="preferred_contact_method" className={styles.input} defaultValue="">
        <option value="">— Unspecified —</option>
        <option value="email">Email</option>
        <option value="phone">Phone</option>
        <option value="sms">SMS</option>
      </select>

      <label className={styles.label} htmlFor="internal_notes">
        Internal notes
      </label>
      <textarea
        id="internal_notes"
        name="internal_notes"
        className={styles.textarea}
        placeholder="Gate code, pets, parking, preferred arrival window…"
      />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Add customer'}
      </button>
    </form>
  );
}
