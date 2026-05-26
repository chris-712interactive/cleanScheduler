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
import { updateTenantOperationalSettings } from './actions';
import { operationalSettingsFormInitial } from './operationalSettingsFormState';
import styles from './settings.module.scss';

export function OperationalSettingsForm({
  tenantSlug,
  snapshot,
  readOnly = false,
  smsEditable = false,
  smsTrialLocked = false,
  twilioConfigured = false,
  invoiceReminderEmailEditable = false,
  invoiceReminderSmsEditable = false,
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
    sms_notify_visit_reminder: boolean;
    email_notify_invoice_overdue: boolean;
    sms_notify_invoice_overdue: boolean;
    check_reminder_hold_days: number;
    check_hold_through_deposit: boolean;
  };
  readOnly?: boolean;
  smsEditable?: boolean;
  smsTrialLocked?: boolean;
  twilioConfigured?: boolean;
  invoiceReminderEmailEditable?: boolean;
  invoiceReminderSmsEditable?: boolean;
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
          Controls how your team moves from an accepted quote to scheduled work. Automatic
          scheduling will respect this preference once the engine is built.
        </p>
        <div className={styles.opsRadioStack}>
          {(Object.keys(ACCEPTED_QUOTE_SCHEDULE_MODE_LABEL) as AcceptedQuoteScheduleMode[]).map(
            (value) => (
              <label key={value} className={styles.opsRadio}>
                <input
                  type="radio"
                  name="accepted_quote_schedule_mode"
                  value={value}
                  defaultChecked={snapshot.accepted_quote_schedule_mode === value}
                  disabled={readOnly}
                />
                <span>{ACCEPTED_QUOTE_SCHEDULE_MODE_LABEL[value]}</span>
              </label>
            ),
          )}
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Typical invoicing</legend>
        <p className={styles.opsIntro}>
          Helps staff and future customer flows understand how you prefer to get paid.
        </p>
        <div className={styles.opsRadioStack}>
          {(Object.keys(INVOICE_EXPECTATION_LABEL) as TenantInvoiceExpectation[]).map((value) => (
            <label key={value} className={styles.opsRadio}>
              <input
                type="radio"
                name="invoice_expectation"
                value={value}
                defaultChecked={snapshot.invoice_expectation === value}
                disabled={readOnly}
              />
              <span>{INVOICE_EXPECTATION_LABEL[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Quote email notifications (Resend)</legend>
        <p className={styles.opsIntro}>
          When enabled, the app sends transactional email using your server&apos;s Resend
          configuration. Quote &quot;sent&quot; goes to the customer; accept/decline notices go to
          your workspace onboarding email when available.
        </p>
        <div className={styles.opsCheckboxGrid}>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="email_notify_quote_sent"
              defaultChecked={snapshot.email_notify_quote_sent}
              disabled={readOnly}
            />
            <span>Email customer when a quote is marked Sent</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="email_notify_quote_accepted"
              defaultChecked={snapshot.email_notify_quote_accepted}
              disabled={readOnly}
            />
            <span>Email your team when a customer accepts a quote</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="email_notify_quote_declined"
              defaultChecked={snapshot.email_notify_quote_declined}
              disabled={readOnly}
            />
            <span>Email your team when a customer declines a quote</span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>SMS notifications (Pro)</legend>
        <p className={styles.opsIntro}>
          {smsEditable
            ? twilioConfigured
              ? 'Transactional SMS via Twilio. Counts against your monthly Pro SMS segment allowance. Customers with email-only preference are skipped.'
              : 'Twilio is not configured on this server. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to enable sends.'
            : smsTrialLocked
              ? 'SMS is included with Pro after you subscribe. Add a payment method from Workspace billing to unlock these toggles during your trial.'
              : 'Upgrade to Pro to send quote and visit reminder texts to customers.'}
        </p>
        <div className={styles.opsCheckboxGrid}>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_quote_sent"
              defaultChecked={snapshot.sms_notify_quote_sent}
              disabled={readOnly || !smsEditable || !twilioConfigured}
            />
            <span>SMS customer when a quote is marked Sent</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_quote_accepted"
              defaultChecked={snapshot.sms_notify_quote_accepted}
              disabled={readOnly || !smsEditable || !twilioConfigured}
            />
            <span>SMS your team when a customer accepts</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_quote_declined"
              defaultChecked={snapshot.sms_notify_quote_declined}
              disabled={readOnly || !smsEditable || !twilioConfigured}
            />
            <span>SMS your team when a customer declines</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_visit_reminder"
              defaultChecked={snapshot.sms_notify_visit_reminder}
              disabled={readOnly || !smsEditable || !twilioConfigured}
            />
            <span>SMS visit reminder ~24 hours before scheduled cleanings</span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Invoice reminders</legend>
        <p className={styles.opsIntro}>
          {invoiceReminderEmailEditable
            ? 'Daily cron sends overdue reminders when an open invoice is past due. Check payments in holding status respect your check hold window.'
            : 'Upgrade to Business to send automated overdue invoice reminder emails.'}
        </p>
        <div className={styles.opsCheckboxGrid}>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="email_notify_invoice_overdue"
              defaultChecked={snapshot.email_notify_invoice_overdue}
              disabled={readOnly || !invoiceReminderEmailEditable}
            />
            <span>Email customer when an invoice is overdue</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_invoice_overdue"
              defaultChecked={snapshot.sms_notify_invoice_overdue}
              disabled={readOnly || !invoiceReminderSmsEditable || !twilioConfigured}
            />
            <span>SMS customer when an invoice is overdue (Pro)</span>
          </label>
        </div>
        <div className={styles.opsCheckboxGrid}>
          <label className={styles.opsField}>
            <span className={styles.opsLabel}>Check reminder hold (days)</span>
            <input
              type="number"
              name="check_reminder_hold_days"
              min={0}
              max={120}
              defaultValue={snapshot.check_reminder_hold_days}
              disabled={readOnly}
              className={styles.opsInput}
            />
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="check_hold_through_deposit"
              defaultChecked={snapshot.check_hold_through_deposit}
              disabled={readOnly}
            />
            <span>Hold reminders until check is deposited (not just received)</span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.opsFieldset}>
        <legend className={styles.opsLegend}>Payment methods customers may use</legend>
        <p className={styles.opsIntro}>
          When customers accept quotes or pay invoices in the app, only these options will be
          offered. Card/ACH may still depend on your Stripe Connect setup under Billing.
        </p>
        <div className={styles.opsCheckboxGrid}>
          {CUSTOMER_PAYMENT_METHOD_VALUES.map((m) => (
            <label key={m} className={styles.opsCheckbox}>
              <input type="checkbox" name={`method_${m}`} defaultChecked={allowed.has(m)} disabled={readOnly} />
              <span>{CUSTOMER_PAYMENT_METHOD_LABEL[m]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {!readOnly ? (
        <button type="submit" className={styles.opsSubmit} disabled={pending}>
          {pending ? 'Saving…' : 'Save workflow & payment options'}
        </button>
      ) : null}
    </form>
  );
}
