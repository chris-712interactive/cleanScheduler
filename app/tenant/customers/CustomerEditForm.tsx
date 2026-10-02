'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import { CUSTOMER_PREFERRED_BILLING_OPTIONS } from '@/lib/tenant/customerBillingPreference';
import type { CustomerEditSnapshot } from '@/lib/tenant/customerEditSnapshot';
import { updateTenantCustomer, type CustomerFormState } from './actions';
import styles from './customers.module.scss';

export type { CustomerEditSnapshot } from '@/lib/tenant/customerEditSnapshot';

const initial: CustomerFormState = {};

export function CustomerEditForm({
  tenantSlug,
  snapshot: initialSnapshot,
  onCancel,
}: {
  tenantSlug: string;
  snapshot: CustomerEditSnapshot;
  onCancel?: () => void;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [state, formAction, pending] = useActionState(updateTenantCustomer, initial);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const onCustomerSnapshot = useCallback((next: CustomerEditSnapshot) => {
    setSnapshot(next);
  }, []);

  useServerActionSnapshot(state.success, state.customerSnapshot, onCustomerSnapshot);

  return (
    <form action={formAction} className={styles.detailForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="customer_id" value={snapshot.customerId} />

      <div className={styles.fieldRow}>
        <div className={styles.field}>
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
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit_last_name">
            Last name
          </label>
          <input
            id="edit_last_name"
            name="last_name"
            className={styles.input}
            autoComplete="family-name"
            defaultValue={snapshot.lastName}
          />
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
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
        </div>
        <div className={styles.field}>
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
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
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
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit_company_name">
            Company name
          </label>
          <input
            id="edit_company_name"
            name="company_name"
            className={styles.input}
            defaultValue={snapshot.companyName}
          />
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit_preferred_payment_method">
            Preferred billing
          </label>
          <select
            id="edit_preferred_payment_method"
            name="preferred_payment_method"
            className={styles.input}
            defaultValue={snapshot.preferredPaymentMethod || 'card'}
          >
            {CUSTOMER_PREFERRED_BILLING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.hint}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
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
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit_internal_notes">
          Office notes
        </label>
        <textarea
          id="edit_internal_notes"
          name="internal_notes"
          className={styles.textareaCompact}
          defaultValue={snapshot.internalNotes}
          placeholder="Billing preferences, account history, office-only context"
        />
        <p className={styles.sectionHint}>
          Visible to the office only. Field employees do not see these.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit_field_notes">
          Crew notes
        </label>
        <textarea
          id="edit_field_notes"
          name="field_notes"
          className={styles.textareaCompact}
          defaultValue={snapshot.fieldNotes}
          placeholder="Pets, parking, preferred arrival window, supplies to bring"
        />
        <p className={styles.sectionHint}>Shown to field employees on this customer’s jobs.</p>
      </div>

      <label className={styles.checkboxRow} htmlFor="edit_marketing_email_opt_in">
        <input
          id="edit_marketing_email_opt_in"
          name="marketing_email_opt_in"
          type="checkbox"
          defaultChecked={snapshot.marketingEmailOptIn}
        />
        <span>Customer opted in to marketing emails</span>
      </label>

      <div className={styles.formFooter}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        {onCancel ? (
          <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
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
      </div>
    </form>
  );
}
