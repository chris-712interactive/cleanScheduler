'use client';

import Link from 'next/link';
import { useActionState, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import type { OperationalSettingsFormSnapshot } from '@/lib/tenant/operationalSettingsFormSnapshot';
import {
  CUSTOMER_PAYMENT_METHOD_LABEL,
  CUSTOMER_PAYMENT_METHOD_VALUES,
  MESSAGING_CHANNEL_LABEL,
  type AcceptedQuoteScheduleMode,
  type TenantInvoiceExpectation,
} from '@/lib/tenant/operationalSettings';
import { SettingsSaveButton } from './SettingsSaveButton';
import { updateTenantOperationalSettings } from './actions';
import { operationalSettingsFormInitial } from './operationalSettingsFormState';
import styles from './operations/operations-settings.module.scss';

const WORKFLOW_CHOICES: {
  value: AcceptedQuoteScheduleMode;
  title: string;
  hint: string;
  badge?: string;
}[] = [
  {
    value: 'prompt_staff',
    title: 'Team schedules after acceptance',
    hint: 'Your staff picks visit dates after a customer accepts. Per-line auto-schedule flags on quotes are ignored.',
  },
  {
    value: 'auto_schedule',
    title: 'Automatic scheduling',
    hint: 'When a customer accepts, create scheduled visits for quote lines you flagged for auto-schedule (using service durations and crew availability).',
  },
];

const INVOICING_CHOICES: {
  value: TenantInvoiceExpectation;
  title: string;
  hint: string;
}[] = [
  {
    value: 'pay_after_service',
    title: 'Bill after the cleaning',
    hint: 'Send invoices once work is done. Best for recurring residential and most commercial jobs.',
  },
  {
    value: 'prepay',
    title: 'Collect payment before service',
    hint: 'Use when you require prepayment or deposits before dispatching a crew.',
  },
];

const QUOTE_NOTIFICATION_ROWS = [
  {
    label: 'Quote sent to customer',
    emailName: 'email_notify_quote_sent',
    smsName: 'sms_notify_quote_sent',
    emailKey: 'email_notify_quote_sent' as const,
    smsKey: 'sms_notify_quote_sent' as const,
  },
  {
    label: 'Customer accepts a quote',
    emailName: 'email_notify_quote_accepted',
    smsName: 'sms_notify_quote_accepted',
    emailKey: 'email_notify_quote_accepted' as const,
    smsKey: 'sms_notify_quote_accepted' as const,
    audience: 'your team',
  },
  {
    label: 'Customer declines a quote',
    emailName: 'email_notify_quote_declined',
    smsName: 'sms_notify_quote_declined',
    emailKey: 'email_notify_quote_declined' as const,
    smsKey: 'sms_notify_quote_declined' as const,
    audience: 'your team',
  },
] as const;

export function OperationalSettingsForm({
  tenantSlug,
  snapshot: initialSnapshot,
  readOnly = false,
  smsEditable = false,
  smsTrialLocked = false,
  sentDmConfigured = false,
  invoiceReminderEmailEditable = false,
  visitReminderEmailEditable = false,
  invoiceReminderSmsEditable = false,
  smsUsageSummary,
}: {
  tenantSlug: string;
  snapshot: OperationalSettingsFormSnapshot;
  readOnly?: boolean;
  smsEditable?: boolean;
  smsTrialLocked?: boolean;
  sentDmConfigured?: boolean;
  invoiceReminderEmailEditable?: boolean;
  visitReminderEmailEditable?: boolean;
  invoiceReminderSmsEditable?: boolean;
  smsUsageSummary?: string | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const allowed = new Set(snapshot.allowed_customer_payment_methods);
  const messagingChannels = new Set(snapshot.messaging_channels);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const onSettingsSnapshot = useCallback((next: OperationalSettingsFormSnapshot) => {
    setSnapshot(next);
  }, []);

  const [state, formAction, pending] = useActionState(
    updateTenantOperationalSettings,
    operationalSettingsFormInitial,
  );
  useServerActionSnapshot(state.success, state.settingsSnapshot, onSettingsSnapshot);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    submitServerActionForm(event, formAction);
  };

  const enabledEmailCount = useMemo(() => {
    let count = 0;
    if (snapshot.email_notify_quote_sent) count += 1;
    if (snapshot.email_notify_quote_accepted) count += 1;
    if (snapshot.email_notify_quote_declined) count += 1;
    if (snapshot.email_notify_invoice_overdue) count += 1;
    if (snapshot.email_notify_customer_message) count += 1;
    return count;
  }, [snapshot]);

  const enabledSmsCount = useMemo(() => {
    if (!smsEditable) return 0;
    let count = 0;
    if (snapshot.sms_notify_quote_sent) count += 1;
    if (snapshot.sms_notify_quote_accepted) count += 1;
    if (snapshot.sms_notify_quote_declined) count += 1;
    if (snapshot.sms_notify_visit_reminder) count += 1;
    if (snapshot.sms_notify_invoice_overdue) count += 1;
    return count;
  }, [snapshot, smsEditable]);

  const smsDisabled = readOnly || !smsEditable || !sentDmConfigured;

  return (
    <form onSubmit={handleSubmit} className={styles.opsStack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      {state.error ? (
        <p className={styles.bannerError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.bannerSuccess} role="status">
          Settings saved.
        </p>
      ) : null}

      <section className={styles.opsHero} aria-labelledby="ops-overview-heading">
        <h2 id="ops-overview-heading" className={styles.opsHeroTitle}>
          How your business runs day to day
        </h2>
        <p className={styles.opsHeroLead}>
          Set defaults for quotes, scheduling, customer payments, and automatic notifications. You
          can change these anytime — updates apply to new activity going forward.
        </p>
        <div className={styles.opsHeroMeta}>
          <span className={styles.summaryChip}>
            {snapshot.allowed_customer_payment_methods.length} payment methods enabled
          </span>
          <span className={styles.summaryChip}>{enabledEmailCount} email alerts on</span>
          {smsEditable ? (
            <span className={styles.summaryChip}>{enabledSmsCount} text alerts on</span>
          ) : null}
        </div>
      </section>

      <nav className={styles.sectionNav} aria-label="Jump to section">
        <a className={styles.sectionNavLink} href="#ops-workflow">
          Workflow
        </a>
        <a className={styles.sectionNavLink} href="#ops-payments">
          Payments
        </a>
        <a className={styles.sectionNavLink} href="#ops-notifications">
          Notifications
        </a>
        <a className={styles.sectionNavLink} href="#ops-checks">
          Check reminders
        </a>
      </nav>

      <section
        id="ops-workflow"
        className={styles.settingsSection}
        aria-labelledby="workflow-heading"
      >
        <header className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Workflow</p>
          <h3 id="workflow-heading" className={styles.sectionTitle}>
            Quotes & scheduling
          </h3>
          <p className={styles.sectionLead}>
            Choose what happens after a customer accepts a quote and how you typically invoice for
            work.
          </p>
        </header>

        <div>
          <p className={styles.subsectionTitle}>Before sending quotes</p>
          <label className={styles.paymentToggle}>
            <input
              type="checkbox"
              name="require_consultation_before_quote"
              defaultChecked={snapshot.require_consultation_before_quote}
              disabled={readOnly}
            />
            <span>Require a completed consultation before sending quotes</span>
          </label>
          <p className={styles.technicalNote}>
            When enabled, new customers need a completed consultation visit on the schedule before
            you can send them a quote. Staff can still prepare draft quotes while waiting.
          </p>
          <div className={styles.inlineFieldRow}>
            <label className={styles.numberField}>
              <span className={styles.numberLabel}>Typical consultation length (minutes)</span>
              <input
                id="consultation_duration_minutes"
                name="consultation_duration_minutes"
                type="number"
                min={15}
                max={480}
                step={15}
                className={styles.numberInput}
                defaultValue={snapshot.consultation_duration_minutes}
                disabled={readOnly}
              />
            </label>
          </div>
          <p className={styles.technicalNote}>
            Used to set the end time when scheduling consultations. Allowed range is 15–480 minutes.
          </p>
        </div>

        <div>
          <p className={styles.subsectionTitle}>After a quote is accepted</p>
          <div className={styles.choiceGrid}>
            {WORKFLOW_CHOICES.map((choice) => (
              <label key={choice.value} className={styles.choiceCard}>
                <input
                  type="radio"
                  name="accepted_quote_schedule_mode"
                  value={choice.value}
                  defaultChecked={snapshot.accepted_quote_schedule_mode === choice.value}
                  disabled={readOnly}
                />
                <span className={styles.choiceTitle}>{choice.title}</span>
                <span className={styles.choiceHint}>{choice.hint}</span>
                {choice.badge ? <span className={styles.choiceBadge}>{choice.badge}</span> : null}
              </label>
            ))}
          </div>
          {snapshot.accepted_quote_schedule_mode === 'auto_schedule' ? (
            <div>
              <label className={styles.paymentToggle}>
                <input
                  type="checkbox"
                  name="recurring_starts_after_initial"
                  defaultChecked={snapshot.recurring_starts_after_initial}
                  disabled={readOnly}
                />
                <span>Start recurring visits one full cadence after initial / one-time work</span>
              </label>
              <p className={styles.technicalNote}>
                When a quote includes both a deep clean and ongoing service, the first recurring
                visit is scheduled at least one week (or biweekly/monthly interval) after the last
                initial visit — not the same day.
              </p>
              <label className={styles.paymentToggle}>
                <input
                  type="checkbox"
                  name="allow_same_day_initial_recurring"
                  defaultChecked={snapshot.allow_same_day_initial_recurring}
                  disabled={readOnly}
                />
                <span>Allow recurring and initial visits on the same day</span>
              </label>
              <p className={styles.technicalNote}>
                Off by default. Turn on only if you intentionally book both on the same day.
              </p>
            </div>
          ) : (
            <>
              <input type="hidden" name="recurring_starts_after_initial" value="off" readOnly />
              <input type="hidden" name="allow_same_day_initial_recurring" value="off" readOnly />
            </>
          )}
        </div>

        <div>
          <p className={styles.subsectionTitle}>Default invoicing style</p>
          <div className={styles.choiceGrid}>
            {INVOICING_CHOICES.map((choice) => (
              <label key={choice.value} className={styles.choiceCard}>
                <input
                  type="radio"
                  name="invoice_expectation"
                  value={choice.value}
                  defaultChecked={snapshot.invoice_expectation === choice.value}
                  disabled={readOnly}
                />
                <span className={styles.choiceTitle}>{choice.title}</span>
                <span className={styles.choiceHint}>{choice.hint}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section
        id="ops-payments"
        className={styles.settingsSection}
        aria-labelledby="payments-heading"
      >
        <header className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Payments</p>
          <h3 id="payments-heading" className={styles.sectionTitle}>
            Payment methods for customers
          </h3>
          <p className={styles.sectionLead}>
            Choose which options customers can pick when accepting quotes or paying invoices online.
            Card payments still require Stripe setup under{' '}
            <Link href="/billing/payment-setup">Billing → Accept card payments</Link>.
          </p>
        </header>

        <div className={styles.paymentGrid}>
          {CUSTOMER_PAYMENT_METHOD_VALUES.map((method) => (
            <label key={method} className={styles.paymentToggle}>
              <input
                type="checkbox"
                name={`method_${method}`}
                defaultChecked={allowed.has(method)}
                disabled={readOnly}
              />
              <span>{CUSTOMER_PAYMENT_METHOD_LABEL[method]}</span>
            </label>
          ))}
        </div>
        <p className={styles.technicalNote}>
          Select at least one method. Customers only see options you enable here.
        </p>
      </section>

      <section
        id="ops-notifications"
        className={styles.settingsSection}
        aria-labelledby="notifications-heading"
      >
        <header className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Notifications</p>
          <h3 id="notifications-heading" className={styles.sectionTitle}>
            Customer & team alerts
          </h3>
          <p className={styles.sectionLead}>
            Turn email and text alerts on or off for quote activity, visit reminders, and overdue
            invoices.
          </p>
        </header>

        {smsEditable && smsUsageSummary ? (
          <p className={styles.sectionLead}>
            Text message usage: {smsUsageSummary}.{' '}
            <Link href="/billing" className={styles.planNoticeLink}>
              View billing
            </Link>
          </p>
        ) : smsTrialLocked ? (
          <div className={styles.planNotice} role="status">
            <p className={styles.planNoticeTitle}>Text alerts unlock with Pro</p>
            <p className={styles.planNoticeBody}>
              Subscribe to enable quote and visit reminder texts.{' '}
              <Link href="/billing" className={styles.planNoticeLink}>
                Add a payment method
              </Link>
            </p>
          </div>
        ) : !smsEditable ? (
          <div className={styles.planNotice}>
            <p className={styles.planNoticeTitle}>Upgrade for text alerts</p>
            <p className={styles.planNoticeBody}>
              Pro includes customer text notifications for quotes, visit reminders, and overdue
              invoices.
            </p>
          </div>
        ) : null}

        <div>
          <p className={styles.subsectionTitle}>Quote updates</p>
          <div className={styles.notificationTableWrap}>
            <table className={styles.notificationTable}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Email</th>
                  <th scope="col">Text</th>
                </tr>
              </thead>
              <tbody>
                {QUOTE_NOTIFICATION_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">
                      {row.label}
                      {'audience' in row ? (
                        <span className={styles.notifyUnavailable}> — notifies {row.audience}</span>
                      ) : null}
                    </th>
                    <td>
                      <label className={styles.notifyToggle}>
                        <input
                          type="checkbox"
                          name={row.emailName}
                          defaultChecked={snapshot[row.emailKey]}
                          disabled={readOnly}
                        />
                        On
                      </label>
                    </td>
                    <td>
                      {smsDisabled ? (
                        <span className={styles.notifyUnavailable}>
                          {smsTrialLocked ? 'Pro' : !smsEditable ? 'Pro' : 'Unavailable'}
                        </span>
                      ) : (
                        <label className={styles.notifyToggle}>
                          <input
                            type="checkbox"
                            name={row.smsName}
                            defaultChecked={snapshot[row.smsKey]}
                            disabled={smsDisabled}
                          />
                          On
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className={styles.subsectionTitle}>Visit reminders</p>
          <div className={styles.notificationTableWrap}>
            <table className={styles.notificationTable}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Email</th>
                  <th scope="col">Text</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Reminder ~24 hours before a scheduled cleaning</th>
                  <td>
                    {visitReminderEmailEditable ? (
                      <label className={styles.notifyToggle}>
                        <input
                          type="checkbox"
                          name="email_notify_visit_reminder"
                          defaultChecked={snapshot.email_notify_visit_reminder}
                          disabled={readOnly}
                        />
                        On
                      </label>
                    ) : (
                      <span className={styles.notifyUnavailable}>Unavailable</span>
                    )}
                  </td>
                  <td>
                    {smsDisabled ? (
                      <span className={styles.notifyUnavailable}>
                        {smsTrialLocked ? 'Pro' : !smsEditable ? 'Pro' : 'Unavailable'}
                      </span>
                    ) : (
                      <label className={styles.notifyToggle}>
                        <input
                          type="checkbox"
                          name="sms_notify_visit_reminder"
                          defaultChecked={snapshot.sms_notify_visit_reminder}
                          disabled={smsDisabled}
                        />
                        On
                      </label>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className={styles.subsectionTitle}>Customer portal messages</p>
          <div className={styles.notificationTableWrap}>
            <table className={styles.notificationTable}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Email</th>
                  <th scope="col">Text</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Customer sends or replies in Messages</th>
                  <td>
                    <label className={styles.notifyToggle}>
                      <input
                        type="checkbox"
                        name="email_notify_customer_message"
                        defaultChecked={snapshot.email_notify_customer_message}
                        disabled={readOnly}
                      />
                      On
                    </label>
                  </td>
                  <td>
                    <span className={styles.notifyUnavailable}>Not available</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.technicalNote}>
            Email goes to your owner or company address on file. The sidebar badge counts open
            conversations waiting for your reply.
          </p>
        </div>

        <div>
          <p className={styles.subsectionTitle}>Overdue invoices</p>
          {!invoiceReminderEmailEditable ? (
            <div className={styles.planNotice}>
              <p className={styles.planNoticeTitle}>Email reminders unavailable</p>
              <p className={styles.planNoticeBody}>
                Overdue invoice email reminders are not enabled for this workspace.
              </p>
            </div>
          ) : null}
          <div className={styles.notificationTableWrap}>
            <table className={styles.notificationTable}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Email</th>
                  <th scope="col">Text</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Invoice is past due</th>
                  <td>
                    {invoiceReminderEmailEditable ? (
                      <label className={styles.notifyToggle}>
                        <input
                          type="checkbox"
                          name="email_notify_invoice_overdue"
                          defaultChecked={snapshot.email_notify_invoice_overdue}
                          disabled={readOnly}
                        />
                        On
                      </label>
                    ) : (
                      <span className={styles.notifyUnavailable}>Unavailable</span>
                    )}
                  </td>
                  <td>
                    {smsDisabled || !invoiceReminderSmsEditable ? (
                      <span className={styles.notifyUnavailable}>
                        {smsTrialLocked || !invoiceReminderSmsEditable ? 'Pro' : 'Unavailable'}
                      </span>
                    ) : (
                      <label className={styles.notifyToggle}>
                        <input
                          type="checkbox"
                          name="sms_notify_invoice_overdue"
                          defaultChecked={snapshot.sms_notify_invoice_overdue}
                          disabled={smsDisabled}
                        />
                        On
                      </label>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {invoiceReminderEmailEditable ? (
            <p className={styles.technicalNote}>
              Overdue reminders run once per day for open invoices past their due date.
            </p>
          ) : null}
        </div>

        {smsEditable && sentDmConfigured ? (
          <div>
            <p className={styles.subsectionTitle}>Text delivery channels</p>
            <p className={styles.sectionLead}>
              SMS is always used for text alerts. Enable additional channels if your messaging
              provider supports them.
            </p>
            <div className={styles.channelGrid}>
              <label className={styles.paymentToggle}>
                <input type="checkbox" checked disabled readOnly />
                <span>{MESSAGING_CHANNEL_LABEL.sms} (required)</span>
              </label>
              <label className={styles.paymentToggle}>
                <input
                  type="checkbox"
                  name="messaging_channel_whatsapp"
                  defaultChecked={messagingChannels.has('whatsapp')}
                  disabled={readOnly}
                />
                <span>{MESSAGING_CHANNEL_LABEL.whatsapp}</span>
              </label>
              <label className={styles.paymentToggle}>
                <input
                  type="checkbox"
                  name="messaging_channel_rcs"
                  defaultChecked={messagingChannels.has('rcs')}
                  disabled={readOnly}
                />
                <span>{MESSAGING_CHANNEL_LABEL.rcs}</span>
              </label>
            </div>
          </div>
        ) : smsEditable && !sentDmConfigured ? (
          <p className={styles.technicalNote} role="status">
            Text messaging is not configured on this server yet. Contact support if alerts stay
            unavailable.
          </p>
        ) : null}
      </section>

      <section id="ops-checks" className={styles.settingsSection} aria-labelledby="checks-heading">
        <header className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Check payments</p>
          <h3 id="checks-heading" className={styles.sectionTitle}>
            Check reminder timing
          </h3>
          <p className={styles.sectionLead}>
            When a customer pays by check, you can pause overdue invoice reminders until the check
            has had time to clear or be deposited.
          </p>
        </header>

        <div className={styles.inlineFieldRow}>
          <label className={styles.numberField}>
            <span className={styles.numberLabel}>Wait before reminding (days)</span>
            <input
              type="number"
              name="check_reminder_hold_days"
              min={0}
              max={120}
              defaultValue={snapshot.check_reminder_hold_days}
              disabled={readOnly}
              className={styles.numberInput}
            />
          </label>
          <label className={styles.inlineCheckbox}>
            <input
              type="checkbox"
              name="check_hold_through_deposit"
              defaultChecked={snapshot.check_hold_through_deposit}
              disabled={readOnly}
            />
            <span>Keep waiting until the check is deposited, not just received</span>
          </label>
        </div>
      </section>

      {!readOnly ? (
        <div className={styles.saveBar}>
          <p className={styles.saveBarHint}>Save once after updating any sections above.</p>
          <SettingsSaveButton pending={pending} idleLabel="Save operations settings" />
        </div>
      ) : null}
    </form>
  );
}
