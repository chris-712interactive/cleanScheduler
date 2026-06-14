import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { ThirdPartyServicesSection } from '@/components/marketing/ThirdPartyServicesSection';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from '../legal.module.scss';

export const metadata = buildMarketingPageMetadata({
  path: '/privacy',
  title: 'Privacy Policy',
  description: `How ${PRODUCT_NAME} collects, uses, and shares information, including third-party service providers.`,
});

export default function PrivacyPolicyPage() {
  return (
    <>
      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="Privacy Policy"
            description={`How ${PRODUCT_NAME} handles personal and business information.`}
            backHref="/"
            backLabel="Home"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>

            <p>
              This Privacy Policy describes how {PRODUCT_NAME} (&quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;) collects, uses, and shares information when you use our websites,
              tenant workspaces, customer portals, and related services (collectively, the
              &quot;Service&quot;). By using the Service, you agree to this Policy. If you do not
              agree, do not use the Service.
            </p>

            <h2>1. Who this policy covers</h2>
            <p>
              This policy applies to visitors of our marketing site, business owners and staff who
              create or use a {PRODUCT_NAME} workspace (&quot;Tenant Users&quot;), and end customers
              who access a branded customer portal (&quot;Customer Users&quot;). Tenants are
              generally responsible for the customer data they load into their workspace; we process
              that data on their behalf to provide the Service.
            </p>

            <h2>2. Information we collect</h2>
            <h3>Information you provide</h3>
            <ul>
              <li>
                <strong>Account and profile:</strong> name, email address, phone number, password
                (stored via our authentication provider), job title, and avatar.
              </li>
              <li>
                <strong>Business workspace:</strong> company name, slug, service area, team size,
                branding, operational settings, and billing plan selection.
              </li>
              <li>
                <strong>Customer and operations data:</strong> customer profiles, properties,
                schedules, quotes, invoices, messages, campaigns, and files you upload (such as
                logos or job photos).
              </li>
              <li>
                <strong>Support and sales inquiries:</strong> messages submitted through our contact
                form or email.
              </li>
            </ul>

            <h3>Information collected automatically</h3>
            <ul>
              <li>
                <strong>Usage and device data:</strong> IP address, browser type, pages viewed,
                referring URLs, and timestamps stored in server logs and session cookies.
              </li>
              <li>
                <strong>Payment metadata:</strong> subscription status, invoice IDs, and transaction
                amounts from Stripe (we do not store full payment card numbers).
              </li>
              <li>
                <strong>Email engagement:</strong> delivery, open, click, and bounce events for
                campaign emails processed through Resend webhooks.
              </li>
            </ul>

            <h3>Information from third parties</h3>
            <ul>
              <li>
                <strong>Google sign-in:</strong> if you choose OAuth, we receive basic profile
                information from Google via Supabase Auth.
              </li>
              <li>
                <strong>Stripe:</strong> Connect account status, charges, refunds, disputes, and
                payouts related to your workspace.
              </li>
              <li>
                <strong>Plaid (optional):</strong> when a tenant admin connects a business bank
                account for reconciliation, Plaid provides institution name, account mask, and
                transaction history. We store Plaid access tokens server-side only (never in the
                browser) and use them to sync deposits for invoice matching. See Section 5 and our{' '}
                <Link href="/security/information-security-policy">
                  Information Security Policy
                </Link>
                .
              </li>
            </ul>

            <h3>Bank connection data (Plaid)</h3>
            <p>
              If you connect a business checking account through Plaid, we receive account metadata
              (institution, account name, last four digits) and transaction details needed to
              identify incoming Zelle, ACH, and similar deposits. We use this data only to suggest
              matches against open invoices in your workspace. We do not sell this data. You can
              disconnect your bank at any time from Billing → Bank connection; we call Plaid to
              revoke the connection and stop syncing. Plaid&apos;s handling of data you share during
              Link is described in the{' '}
              <a
                href="https://plaid.com/legal/#end-user-privacy-policy"
                rel="noopener noreferrer"
                target="_blank"
              >
                Plaid End User Privacy Policy
              </a>
              .
            </p>

            <h2>3. How we use information</h2>
            <p>We use information to:</p>
            <ul>
              <li>Provide, maintain, and secure the Service;</li>
              <li>Authenticate users and enforce role-based access within each workspace;</li>
              <li>Process platform subscriptions and, when enabled, tenant payment flows;</li>
              <li>
                Send transactional email and, when configured by a tenant, marketing campaigns;
              </li>
              <li>Generate reports, exports, and operational notifications;</li>
              <li>
                Match bank deposits to open invoices when a tenant connects an account through
                Plaid;
              </li>
              <li>Respond to support requests and improve the product;</li>
              <li>Comply with law and protect against fraud or abuse.</li>
            </ul>

            <h2>4. Legal bases (where applicable)</h2>
            <p>
              If you are in a jurisdiction that requires a legal basis for processing (such as the
              EEA or UK), we rely on: performance of a contract (providing the Service you signed up
              for); legitimate interests (security, product improvement, and B2B communications);
              and consent where required (for example, optional marketing email to addresses a
              tenant supplies).
            </p>

            <h2>5. Third-party service providers</h2>
            <p>
              We use trusted vendors to run the Service. They process data only on our instructions
              and for the purposes described below. Each provider maintains its own privacy policy:
            </p>
            <ThirdPartyServicesSection />

            <h2>6. How we share information</h2>
            <p>We do not sell your personal information. We may share information:</p>
            <ul>
              <li>
                <strong>With service providers</strong> listed in Section 5, under contracts that
                limit their use of the data;
              </li>
              <li>
                <strong>With your organization:</strong> Tenant Users within the same workspace can
                access data according to their role; Customer Users see only data their service
                provider chooses to expose in the portal;
              </li>
              <li>
                <strong>For legal reasons:</strong> when required by law, subpoena, or to protect
                rights, safety, and security;
              </li>
              <li>
                <strong>In a business transfer:</strong> in connection with a merger, acquisition,
                or asset sale, with notice where required by law.
              </li>
            </ul>

            <h2>7. Data retention</h2>
            <p>
              We retain information for as long as your workspace is active and as needed to provide
              the Service, resolve disputes, enforce agreements, and meet legal obligations. When
              you close an account, we delete or anonymize data within a reasonable period unless
              retention is required by law or legitimate business needs (such as billing records).
              Category-specific periods, disposal methods, backup handling, and subprocessor
              retention are described in our{' '}
              <Link href="/data-retention">Data Retention &amp; Disposal Policy</Link>.
            </p>

            <h2>8. Security</h2>
            <p>
              We use industry-standard measures including encrypted connections (HTTPS), hosted
              infrastructure with access controls, row-level security in our database, and
              separation of production and development environments. No method of transmission or
              storage is completely secure; we cannot guarantee absolute security.
            </p>

            <h2>9. Your choices and rights</h2>
            <p>Depending on where you live, you may have the right to:</p>
            <ul>
              <li>Access, correct, or delete personal information we hold about you;</li>
              <li>Export data you provided through workspace tools or by contacting us;</li>
              <li>Object to or restrict certain processing;</li>
              <li>Withdraw consent where processing is consent-based.</li>
            </ul>
            <p>
              Tenant Users can update profile and business settings in the workspace. Customer Users
              should contact their cleaning service provider for portal-specific requests; we will
              assist the provider when they ask us to act on a verified request. To reach us
              directly, email <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or
              use our <Link href="/contact">contact form</Link>.
            </p>

            <h2>10. Cookies and similar technologies</h2>
            <p>
              We use essential cookies and local storage to keep you signed in and remember
              preferences (such as theme). We do not use third-party advertising cookies on the
              Service today. You can control cookies through your browser settings; disabling
              essential cookies may prevent you from using authenticated areas.
            </p>

            <h2>11. Children</h2>
            <p>
              The Service is intended for businesses and is not directed to children under 16. We do
              not knowingly collect personal information from children.
            </p>

            <h2>12. International transfers</h2>
            <p>
              We and our providers may process data in the United States and other countries. Where
              required, we rely on appropriate safeguards such as standard contractual clauses
              offered by our vendors.
            </p>

            <h2>13. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the revised version
              on this page and update the &quot;Last updated&quot; date. Material changes may be
              communicated by email or in-product notice where appropriate.
            </p>

            <h2>14. Contact us</h2>
            <p>
              Questions about this Privacy Policy:{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. You may also{' '}
              <Link href="/contact">contact us through the website</Link>.
            </p>
          </article>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
