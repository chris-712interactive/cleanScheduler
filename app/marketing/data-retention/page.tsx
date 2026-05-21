import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { DataRetentionScheduleTable } from '@/components/marketing/DataRetentionScheduleTable';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { ACTIVE_THIRD_PARTY_SERVICES } from '@/lib/legal/thirdPartyServices';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from '../legal.module.scss';

export const metadata = {
  title: `Data Retention & Disposal · ${PRODUCT_NAME}`,
  description: `How ${PRODUCT_NAME} retains, archives, and disposes of data across workspaces and third-party providers.`,
};

export default function DataRetentionPolicyPage() {
  return (
    <>
      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="Data Retention & Disposal Policy"
            description={`How long ${PRODUCT_NAME} keeps information and how we delete or archive it.`}
            backHref="/"
            backLabel="Home"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>

            <p>
              This Data Retention and Disposal Policy (&quot;Retention Policy&quot;) explains how{' '}
              {PRODUCT_NAME} retains, archives, and disposes of information processed through the
              Service. It supplements our <Link href="/privacy">Privacy Policy</Link> and{' '}
              <Link href="/terms">Terms of Service</Link>. Capitalized terms not defined here have
              the meanings given in those documents.
            </p>

            <h2>1. Purpose and scope</h2>
            <p>This policy applies to:</p>
            <ul>
              <li>Data we store in our production systems (primarily Supabase Postgres and Storage);</li>
              <li>Data processed on our behalf by subprocessors listed in our Privacy Policy;</li>
              <li>
                Tenant workspace data (customer records, schedules, quotes, invoices, campaigns, and
                related files) that cleaning businesses upload or generate through the Service.
              </li>
            </ul>
            <p>
              Tenants remain responsible for their own legal obligations to their customers,
              including notice and retention rules that may differ from this platform schedule.
            </p>

            <h2>2. Principles</h2>
            <ul>
              <li>
                <strong>Purpose limitation:</strong> we retain data only as long as needed to operate
                the Service, meet contractual commitments, resolve disputes, or satisfy legal
                obligations.
              </li>
              <li>
                <strong>Data minimization:</strong> we avoid storing full payment card numbers,
                government ID images, or other sensitive categories outside integrated providers
                (for example, Stripe handles card data).
              </li>
              <li>
                <strong>Secure disposal:</strong> deletion means removing records from active
                databases and storage buckets; where immediate physical erasure from all backups is
                not technically feasible, we rely on backup rotation as described in Section 8.
              </li>
            </ul>

            <h2>3. Retention schedule</h2>
            <p>
              The table below summarizes default retention periods under normal operations. We may
              retain specific records longer when required by law, litigation hold, fraud
              investigation, or an explicit written agreement.
            </p>
            <DataRetentionScheduleTable />

            <h2>4. Workspace lifecycle</h2>
            <h3>Active workspace</h3>
            <p>
              While a tenant workspace is active and in good standing, operational data is retained
              so tenants can run scheduling, billing, reporting, and customer portals without
              interruption.
            </p>
            <h3>Trial expiration or subscription lapse</h3>
            <p>
              When a free trial ends without conversion, or a platform subscription lapses, we may
              restrict access to paid features. Data generally remains stored for a reasonable
              reactivation window (typically aligned with the 90-day post-closure period in Section
              3) unless the tenant requests earlier deletion.
            </p>
            <h3>Workspace closure</h3>
            <p>When a tenant requests workspace closure or we terminate for cause:</p>
            <ol>
              <li>
                We confirm the request with an authorized workspace owner and offer a data export
                window where technically available.
              </li>
              <li>
                We disable sign-in for that workspace and stop processing new customer-facing
                actions (email campaigns, new charges, etc.).
              </li>
              <li>
                Within <strong>90 days</strong>, we delete or anonymize tenant-scoped operational
                data in our primary database and application storage, except categories marked
                &quot;Archived&quot; or &quot;Provider-controlled&quot; in Section 3.
              </li>
              <li>
                Billing, tax, and fraud-related records may be retained for up to{' '}
                <strong>7 years</strong> as described in the schedule.
              </li>
            </ol>

            <h2>5. Individual user and customer requests</h2>
            <h3>Tenant users (staff and owners)</h3>
            <p>
              Users may update profile fields in workspace settings. To delete an authentication
              account entirely, contact{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. If the user
              belongs to multiple workspaces, we delete only what you authorize; membership removal
              from a single workspace does not automatically erase global auth credentials.
            </p>
            <h3>Customer portal users</h3>
            <p>
              End customers of a cleaning business should direct access, correction, and deletion
              requests to their service provider first. We will assist the provider on verified
              instructions. Customer identity records may link a person to multiple tenant workspaces;
              deletion in one workspace does not automatically remove historical records another
              provider holds.
            </p>

            <h2>6. Disposal methods</h2>
            <p>Depending on the data type, disposal means one or more of the following:</p>
            <ul>
              <li>
                <strong>Hard delete:</strong> removing rows via application or database operations,
                including cascade deletes configured on tenant-scoped foreign keys.
              </li>
              <li>
                <strong>Storage object delete:</strong> removing files from Supabase Storage buckets
                (for example, tenant logos, employee avatars, cached report PDFs).
              </li>
              <li>
                <strong>Anonymization:</strong> replacing direct identifiers with irreversible
                placeholders while retaining aggregate statistics (used sparingly).
              </li>
              <li>
                <strong>Provider deletion requests:</strong> instructing subprocessors to delete or
                export data they control, subject to their APIs and legal requirements.
              </li>
            </ul>
            <p>
              We do not sell discarded storage media; cloud providers handle physical media
              destruction under their security programs.
            </p>

            <h2>7. Subprocessor retention</h2>
            <p>
              Each active subprocessor maintains its own retention practices. We select providers
              with reasonable security commitments and limit data shared to what the integration
              requires. Current active providers:
            </p>
            <ul>
              {ACTIVE_THIRD_PARTY_SERVICES.map((service) => (
                <li key={service.name}>
                  <strong>{service.name}:</strong> {service.purpose}{' '}
                  <a href={service.privacyPolicyUrl} rel="noopener noreferrer" target="_blank">
                    Privacy policy
                  </a>
                </li>
              ))}
            </ul>
            <p>
              Payment card and bank account details entered through Stripe or (when enabled) Plaid
              are retained under those providers&apos; schedules even after we delete workspace
              mirrors. Email content and delivery logs at Resend follow Resend&apos;s retention.
              Authentication events at Supabase Auth follow Supabase&apos;s documentation.
            </p>

            <h2>8. Backups, logs, and residual data</h2>
            <ul>
              <li>
                <strong>Backups:</strong> point-in-time and periodic backups may contain deleted
                records until those backups age out. We do not use backups to serve live product
                features or to restore deleted tenant data on request unless required for disaster
                recovery.
              </li>
              <li>
                <strong>Application logs:</strong> hosting and error logs typically roll off within
                30–90 days and may include IP addresses, URLs, and error stack traces.
              </li>
              <li>
                <strong>Cached artifacts:</strong> report PDFs and report run JSON expire on a short
                TTL (see schedule); regenerating a report creates new cache rows.
              </li>
            </ul>

            <h2>9. Legal hold and exceptions</h2>
            <p>
              We may suspend routine deletion when we believe preservation is required to comply with
              law, respond to lawful process, investigate abuse, or defend legal claims. When a hold
              ends, normal disposal resumes for data no longer required.
            </p>

            <h2>10. Security of retained data</h2>
            <p>
              Data retained under this policy is subject to the security measures described in our{' '}
              <Link href="/privacy">Privacy Policy</Link>, including encryption in transit, access
              controls, row-level security, and separation of production and non-production
              environments.
            </p>

            <h2>11. Changes to this policy</h2>
            <p>
              We may update retention periods or disposal practices as the product or law evolves. We
              will post changes on this page and update the &quot;Last updated&quot; date. Material
              reductions in retention (favorable to users) may apply prospectively; extensions will
              be communicated where appropriate.
            </p>

            <h2>12. Contact</h2>
            <p>
              Retention or deletion questions:{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. You may also use
              our <Link href="/contact">contact form</Link>.
            </p>
          </article>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
