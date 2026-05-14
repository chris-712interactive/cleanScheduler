'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import {
  ACCEPTED_QUOTE_SCHEDULE_MODE_LABEL,
  CUSTOMER_PAYMENT_METHOD_LABEL,
  CUSTOMER_PAYMENT_METHOD_VALUES,
  INVOICE_EXPECTATION_LABEL,
  type AcceptedQuoteScheduleMode,
  type TenantInvoiceExpectation,
  type TenantPaymentMethod,
} from '@/lib/tenant/operationalSettings';
import {
  updateTenantOperationalSettings,
  operationalSettingsFormInitial,
} from './actions';
import styles from './settings.module.scss';

export function OperationalSettingsForm({
  tenantSlug,
  snapshot,
}: {
  tenantSlug: string;
  snapshot: {
    accepted_quote_schedule_mode: AcceptedQuoteScheduleMode;
    invoice_expectation: TenantInvoiceExpectation;
    allowed_customer_payment_methods: TenantPaymentMethod[];
    email_notify_quote_sent: boolean;
    email_notify_quote_accepted: boolean;
    email_notify_quote_declined: boolean;
    sms_notify_quote_sent: boolean;
    sms_notify_quote_accepted: boolean;
    sms_notify_quote_declined: boolean;
  };
}) {
  const allowed = new Set(snapshot.allowed_customer_payment_methods);

  const [state, formAction, pending] = useActionState(
    updateTenantOperationalSettings,
    operationalSettingsFormInitial,
  );
  useRefreshOnServerActionSuccess(state.success);

  return (
    <form action={formAction} className={styles.opsForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.opsError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.opsSuccess} role="status">
          Saved.
        </p>
      ) : null}

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>When a quote is accepted</legend>
        <p className={styles.opsIntro}>
          Controls how your team moves from an accepted quote to scheduled work. Automatic scheduling will
          respect this preference once the engine is built.
        </p>
        <div className={styles.opsRadioStack}>
          {(Object.keys(ACCEPTED_QUOTE_SCHEDULE_MODE_LABEL) as AcceptedQuoteScheduleMode[]).map((value) => (
            <label key={value} className={styles.opsRadio}>
              <input
                type="radio"
                name="accepted_quote_schedule_mode"
                value={value}
                defaultChecked={snapshot.accepted_quote_schedule_mode === value}
              />
              <span>{ACCEPTED_QUOTE_SCHEDULE_MODE_LABEL[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Typical invoicing</legend>
        <p className={styles.opsIntro}>Helps staff and future customer flows understand how you prefer to get paid.</p>
        <div className={styles.opsRadioStack}>
          {(Object.keys(INVOICE_EXPECTATION_LABEL) as TenantInvoiceExpectation[]).map((value) => (
            <label key={value} className={styles.opsRadio}>
              <input
                type="radio"
                name="invoice_expectation"
                value={value}
                defaultChecked={snapshot.invoice_expectation === value}
              />
              <span>{INVOICE_EXPECTATION_LABEL[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Quote email notifications (Resend)</legend>
        <p className={styles.opsIntro}>
          When enabled, the app sends transactional email using your server&apos;s Resend configuration.
          Quote &quot;sent&quot; goes to the customer; accept/decline notices go to your workspace onboarding
          email when available.
        </p>
        <div className={styles.opsCheckboxGrid}>
          <label className={styles.opsCheckbox}>
            <input type="checkbox" name="email_notify_quote_sent" defaultChecked={snapshot.email_notify_quote_sent} />
            <span>Email customer when a quote is marked Sent</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="email_notify_quote_accepted"
              defaultChecked={snapshot.email_notify_quote_accepted}
            />
            <span>Email your team when a customer accepts a quote</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="email_notify_quote_declined"
              defaultChecked={snapshot.email_notify_quote_declined}
            />
            <span>Email your team when a customer declines a quote</span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Quote SMS notifications (saved — not sent yet)</legend>
        <p className={styles.opsIntro}>
          Twilio SMS delivery for these events is planned; toggles are stored now so you can choose preferences
          ahead of implementation.
        </p>
        <div className={styles.opsCheckboxGrid}>
          <label className={styles.opsCheckbox}>
            <input type="checkbox" name="sms_notify_quote_sent" defaultChecked={snapshot.sms_notify_quote_sent} disabled />
            <span>SMS customer when a quote is marked Sent</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_quote_accepted"
              defaultChecked={snapshot.sms_notify_quote_accepted}
              disabled
            />
            <span>SMS your team when a customer accepts</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_quote_declined"
              defaultChecked={snapshot.sms_notify_quote_declined}
              disabled
            />
            <span>SMS your team when a customer declines</span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Payment methods customers may use</legend>
        <p className={styles.opsIntro}>
          When customers accept quotes or pay invoices in the app, only these options will be offered. Card/ACH
          may still depend on your Stripe Connect setup under Billing.
        </p>
        <div className={styles.opsCheckboxGrid}>
          {CUSTOMER_PAYMENT_METHOD_VALUES.map((m) => (
            <label key={m} className={styles.opsCheckbox}>
              <input type="checkbox" name={`method_${m}`} defaultChecked={allowed.has(m)} />
              <span>{CUSTOMER_PAYMENT_METHOD_LABEL[m]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className={styles.opsSubmit} disabled={pending}>
        {pending ? 'Saving…' : 'Save workflow & payment options'}
      </button>
    </form>
  );
}
