import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { ThirdPartyServicesSection } from '@/components/marketing/ThirdPartyServicesSection';
import { DataRetentionScheduleTable } from '@/components/marketing/DataRetentionScheduleTable';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from '../legal.module.scss';

export const metadata = {
  title: `Security & Trust · ${PRODUCT_NAME}`,
  description: `How ${PRODUCT_NAME} protects tenant and customer data — infrastructure, access controls, subprocessors, and retention.`,
};

export default function SecurityPage() {
  return (
    <>
      <MarketingNav />

      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="Security & Trust"
            description={`How ${PRODUCT_NAME} protects your business data and your customers' information.`}
            backHref="/"
            backLabel="Home"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>

            <p>
              {PRODUCT_NAME} is built for cleaning businesses that trust us with schedules,
              customer records, invoices, and payment activity. This page summarizes our security
              practices. Formal policies:{' '}
              <Link href="/security/information-security-policy">Information Security Policy</Link>,{' '}
              <Link href="/security/access-control-policy">Access Control Policy</Link>. For legal
              terms, see our <Link href="/privacy">Privacy Policy</Link> and{' '}
              <Link href="/terms">Terms of Service</Link>.
            </p>

            <h2>Infrastructure</h2>
            <ul>
              <li>
                <strong>Encrypted in transit:</strong> All web traffic uses HTTPS (TLS).
              </li>
              <li>
                <strong>Hosted infrastructure:</strong> Application hosting on Vercel; database and
                authentication on Supabase (Postgres).
              </li>
              <li>
                <strong>Environment separation:</strong> Production, development, and local
                environments use separate configuration and credentials.
              </li>
              <li>
                <strong>Payments:</strong> Card and bank payment data for your customers is handled
                by Stripe Connect. {PRODUCT_NAME} does not store full card numbers.
              </li>
            </ul>

            <h2>Access controls</h2>
            <ul>
              <li>
                <strong>Workspace isolation:</strong> Each cleaning business operates in its own
                tenant workspace with row-level security in Postgres.
              </li>
              <li>
                <strong>Role-based access:</strong> Owner, admin, employee, and viewer roles control
                what team members can see and change inside a workspace.
              </li>
              <li>
                <strong>Customer portal scope:</strong> End customers only see data their service
                provider exposes through the branded portal.
              </li>
              <li>
                <strong>Platform staff:</strong> Founder support masquerade requires an active
                session record and is limited to authorized platform administrators.
              </li>
            </ul>

            <h2>Operational security</h2>
            <ul>
              <li>
                <strong>Authentication:</strong> Email/password and optional Google OAuth via
                Supabase Auth. TOTP multi-factor authentication (MFA) is required for workspace
                owners and admins before connecting bank accounts through Plaid.
              </li>
              <li>
                <strong>Rate limiting:</strong> Sensitive endpoints such as trial signup and report
                exports are rate-limited to reduce abuse.
              </li>
              <li>
                <strong>Audit logging:</strong> Platform administrative actions, masquerade
                sessions, and privileged member changes are logged.
              </li>
              <li>
                <strong>Vulnerability scanning:</strong> Automated dependency audits and Dependabot
                updates run on every change.
              </li>
              <li>
                <strong>Backups:</strong> Database backups are managed by our infrastructure
                providers with retention periods described below.
              </li>
            </ul>

            <h2>Subprocessors</h2>
            <p>
              We use vetted third-party services to operate {PRODUCT_NAME}. Each provider receives
              only the data needed for its function:
            </p>
            <ThirdPartyServicesSection />

            <h2>Data retention summary</h2>
            <p>
              We retain workspace data while your subscription is active. When a workspace closes,
              data is deleted or archived according to our retention schedule. Billing records may
              be retained longer where required for tax and legal compliance.
            </p>
            <DataRetentionScheduleTable />
            <p>
              Full policy: <Link href="/data-retention">Data Retention &amp; Disposal</Link>.
            </p>

            <h2>Your responsibilities as a tenant</h2>
            <ul>
              <li>Use strong passwords and limit admin access to trusted staff.</li>
              <li>
                Obtain appropriate consent before emailing customers through campaigns (CAN-SPAM).
              </li>
              <li>
                Configure Stripe Connect and bank connections only on accounts you control.
              </li>
              <li>
                Report suspected unauthorized access to{' '}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> promptly.
              </li>
            </ul>

            <h2>Contact</h2>
            <p>
              Security or privacy questions:{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or our{' '}
              <Link href="/contact">contact form</Link>.
            </p>
          </article>
        </Container>
      </main>

      <MarketingFooter />
    </>
  );
}
