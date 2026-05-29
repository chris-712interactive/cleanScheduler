'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import type { OperationalSettingsFormSnapshot } from '@/lib/tenant/operationalSettingsFormSnapshot';
import {
  ACCEPTED_QUOTE_SCHEDULE_MODE_LABEL,
  CUSTOMER_PAYMENT_METHOD_LABEL,
  CUSTOMER_PAYMENT_METHOD_VALUES,
  INVOICE_EXPECTATION_LABEL,
  type AcceptedQuoteScheduleMode,
  type TenantInvoiceExpectation,
  MESSAGING_CHANNEL_LABEL,
} from '@/lib/tenant/operationalSettings';
import { updateTenantOperationalSettings } from './actions';
import { operationalSettingsFormInitial } from './operationalSettingsFormState';
import styles from './settings.module.scss';

export function OperationalSettingsForm({
  tenantSlug,
  snapshot: initialSnapshot,
  readOnly = false,
  smsEditable = false,
  smsTrialLocked = false,
  sentDmConfigured = false,
  invoiceReminderEmailEditable = false,
  invoiceReminderSmsEditable = false,
}: {
  tenantSlug: string;
  snapshot: OperationalSettingsFormSnapshot;
  readOnly?: boolean;
  smsEditable?: boolean;
  smsTrialLocked?: boolean;
  sentDmConfigured?: boolean;
  invoiceReminderEmailEditable?: boolean;
  invoiceReminderSmsEditable?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [formKey, setFormKey] = useState(0);
  const allowed = new Set(snapshot.allowed_customer_payment_methods);
  const messagingChannels = new Set(snapshot.messaging_channels);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const onSettingsSnapshot = useCallback((next: OperationalSettingsFormSnapshot) => {
    setSnapshot(next);
    setFormKey((k) => k + 1);
  }, []);

  const [state, formAction, pending] = useActionState(
    updateTenantOperationalSettings,
    operationalSettingsFormInitial,
  );
  useServerActionSnapshot(state.success, state.settingsSnapshot, onSettingsSnapshot);

  return (
    <form key={formKey} action={formAction} className={styles.opsForm}>
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
            ? sentDmConfigured
              ? 'Transactional SMS via sent.dm. Counts against your monthly Pro SMS segment allowance (each enabled channel counts separately). Customers with email-only preference are skipped.'
              : 'sent.dm is not configured on this server. Add SENT_DM_API_KEY and SENT_DM_TEMPLATE_* variables to enable sends.'
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
              disabled={readOnly || !smsEditable || !sentDmConfigured}
            />
            <span>SMS customer when a quote is marked Sent</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_quote_accepted"
              defaultChecked={snapshot.sms_notify_quote_accepted}
              disabled={readOnly || !smsEditable || !sentDmConfigured}
            />
            <span>SMS your team when a customer accepts</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_quote_declined"
              defaultChecked={snapshot.sms_notify_quote_declined}
              disabled={readOnly || !smsEditable || !sentDmConfigured}
            />
            <span>SMS your team when a customer declines</span>
          </label>
          <label className={styles.opsCheckbox}>
            <input
              type="checkbox"
              name="sms_notify_visit_reminder"
              defaultChecked={snapshot.sms_notify_visit_reminder}
              disabled={readOnly || !smsEditable || !sentDmConfigured}
            />
            <span>SMS visit reminder ~24 hours before scheduled cleanings</span>
          </label>
        </div>
        {smsEditable && sentDmConfigured ? (
          <div className={styles.opsCheckboxGrid}>
            <p className={styles.opsIntro}>
              Delivery channels (SMS is always enabled). WhatsApp and RCS require setup on your
              sent.dm account.
            </p>
            <label className={styles.opsCheckbox}>
              <input type="checkbox" checked disabled readOnly />
              <span>{MESSAGING_CHANNEL_LABEL.sms} (required)</span>
            </label>
            <label className={styles.opsCheckbox}>
              <input
                type="checkbox"
                name="messaging_channel_whatsapp"
                defaultChecked={messagingChannels.has('whatsapp')}
                disabled={readOnly}
              />
              <span>{MESSAGING_CHANNEL_LABEL.whatsapp}</span>
            </label>
            <label className={styles.opsCheckbox}>
              <input
                type="checkbox"
                name="messaging_channel_rcs"
                defaultChecked={messagingChannels.has('rcs')}
                disabled={readOnly}
              />
              <span>{MESSAGING_CHANNEL_LABEL.rcs}</span>
            </label>
          </div>
        ) : null}
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
              disabled={readOnly || !invoiceReminderSmsEditable || !sentDmConfigured}
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
              <input
                type="checkbox"
                name={`method_${m}`}
                defaultChecked={allowed.has(m)}
                disabled={readOnly}
              />
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
