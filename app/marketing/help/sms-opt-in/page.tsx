import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { SmsOptInCheckboxLabel } from '@/components/legal/SmsOptInCheckboxLabel';
import { buildHelpPageMetadata } from '@/lib/help/metadata';
import { LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import { SMS_OPT_IN_CHECKBOX_DISCLOSURE } from '@/lib/legal/smsOptIn';
import styles from './page.module.scss';

export const metadata = buildHelpPageMetadata({
  path: '/help/sms-opt-in',
  title: 'SMS Opt-In Form',
  description:
    'Public customer account signup form showing optional SMS consent for Clean Scheduler 10DLC review.',
});

export default function SmsOptInFormPage() {
  return (
    <main className={styles.page}>
      <Container size="md">
        <PageHeader
          title="SMS opt-in form"
          description="Public reference page for 10DLC campaign review. This mirrors the optional SMS consent checkbox shown during customer account signup."
          backHref="/help/compliance"
          backLabel="Compliance"
          breadcrumbs={[
            { label: 'Help', href: '/help' },
            { label: 'Compliance', href: '/help/compliance' },
            { label: 'SMS opt-in' },
          ]}
        />

        <article className={styles.doc}>
          <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>

          <p className={styles.note}>
            Customers reach this consent step when completing a portal invite from their cleaning
            service provider. SMS opt-in is optional — the account can be created without checking
            the box below.
          </p>

          <Card
            title="Create your password"
            description={`Example customer signup for ${PRODUCT_NAME}. Fields below match the live portal invite flow.`}
          >
            <form className={styles.form} aria-label="SMS opt-in form preview">
              <label className={styles.label} htmlFor="demo_email">
                Email
              </label>
              <input
                id="demo_email"
                name="email"
                type="email"
                className={styles.input}
                defaultValue="customer@example.com"
                readOnly
              />

              <label className={styles.label} htmlFor="demo_password">
                Password
              </label>
              <input
                id="demo_password"
                name="password"
                type="password"
                className={styles.input}
                autoComplete="new-password"
                placeholder="Create a password"
              />

              <label className={styles.label} htmlFor="demo_confirm_password">
                Confirm password
              </label>
              <input
                id="demo_confirm_password"
                name="confirm_password"
                type="password"
                className={styles.input}
                autoComplete="new-password"
                placeholder="Confirm password"
              />

              <label className={styles.label} htmlFor="demo_phone">
                Phone number (optional)
              </label>
              <input
                id="demo_phone"
                name="phone"
                type="tel"
                className={styles.input}
                autoComplete="tel"
                placeholder="(555) 123-4567"
              />

              <label className={styles.checkboxRow} htmlFor="demo_sms_opt_in">
                <input id="demo_sms_opt_in" name="sms_opt_in" type="checkbox" value="on" />
                <SmsOptInCheckboxLabel />
              </label>

              <button type="button" className={styles.submit} disabled>
                Create account &amp; continue
              </button>
            </form>
          </Card>

          <h2>Review checklist</h2>
          <ul>
            <li>
              <strong>Program:</strong> {PRODUCT_NAME} booking and account notification SMS
            </li>
            <li>
              <strong>Consent:</strong> Optional, unchecked checkbox — not required to submit the
              form
            </li>
            <li>
              <strong>Disclosure:</strong> {SMS_OPT_IN_CHECKBOX_DISCLOSURE}
            </li>
            <li>
              <strong>Privacy Policy:</strong> linked from the checkbox label (
              <a href="/privacy">/privacy</a>)
            </li>
            <li>
              <strong>SMS Terms:</strong> linked from the checkbox label (
              <a href="/sms-terms">/sms-terms</a>)
            </li>
          </ul>
        </article>
      </Container>
    </main>
  );
}
