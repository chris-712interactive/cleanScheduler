import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from '../legal.module.scss';

export const metadata = {
  title: `Terms of Service · ${PRODUCT_NAME}`,
  description: `Terms governing use of the ${PRODUCT_NAME} platform, trials, and workspaces.`,
};

export default function TermsOfServicePage() {
  return (
    <>
      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="Terms of Service"
            description={`Rules for using the ${PRODUCT_NAME} platform.`}
            backHref="/"
            backLabel="Home"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>

            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of{' '}
              {PRODUCT_NAME} websites, applications, and related services (the &quot;Service&quot;)
              operated by {PRODUCT_NAME}. By creating an account, starting a trial, or using the
              Service, you agree to these Terms and our{' '}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>

            <h2>1. The Service</h2>
            <p>
              {PRODUCT_NAME} provides multi-tenant software for cleaning businesses, including
              scheduling, quoting, invoicing, customer portals, email campaigns, and reporting.
              Features may change over time; we may add, modify, or discontinue features with
              reasonable notice when practicable.
            </p>

            <h2>2. Eligibility and accounts</h2>
            <ul>
              <li>You must be at least 18 years old and able to form a binding contract.</li>
              <li>
                You are responsible for safeguarding login credentials and for all activity under
                your account.
              </li>
              <li>
                Workspace owners control who is invited as staff and what customer data is stored in
                the workspace.
              </li>
              <li>
                You must provide accurate registration information and keep it up to date.
              </li>
            </ul>

            <h2>3. Free trial and subscriptions</h2>
            <ul>
              <li>
                New workspaces may start with a time-limited free trial as described at sign-up. No
                credit card is required to begin a trial unless we state otherwise.
              </li>
              <li>
                After the trial, continued use of paid features requires an active platform
                subscription billed through Stripe.
              </li>
              <li>
                Fees, plan limits, and renewal terms are shown at checkout or in your billing
                settings. Except where required by law, fees are non-refundable once a billing
                period has started.
              </li>
              <li>
                You may cancel a platform subscription according to in-product billing controls;
                cancellation stops future charges but may not restore access to paid features for
                the current period.
              </li>
            </ul>

            <h2>4. Tenant responsibilities</h2>
            <p>If you operate a workspace on behalf of a cleaning business, you agree that:</p>
            <ul>
              <li>
                You have the right to collect and use customer, employee, and business data you
                upload;
              </li>
              <li>
                You will provide any required notices and obtain any required consents from your
                customers and staff (including for email campaigns and payment collection);
              </li>
              <li>
                You are responsible for the accuracy of quotes, invoices, schedules, and
                communications sent to your customers;
              </li>
              <li>
                Optional Stripe Connect onboarding is your agreement with Stripe; you are responsible
                for compliance with card-network and money-transmission rules applicable to your
                business.
              </li>
            </ul>

            <h2>5. Customer portal and end users</h2>
            <p>
              Customer Users access the Service through a workspace operated by their service
              provider. Their relationship is primarily with that provider. {PRODUCT_NAME} provides
              the technical platform only and is not a party to cleaning contracts between
              providers and their customers.
            </p>

            <h2>6. Acceptable use</h2>
            <p>You may not:</p>
            <ul>
              <li>Violate law or third-party rights;</li>
              <li>Upload malware, attempt unauthorized access, or probe systems without permission;</li>
              <li>Send spam or deceptive messages through the Service;</li>
              <li>Reverse engineer the Service except where permitted by law;</li>
              <li>Resell or sublicense the Service without our written consent;</li>
              <li>Use the Service to store or transmit highly sensitive data categories we do not
                support (such as full payment card numbers outside Stripe, or protected health
                information) unless we agree in writing.</li>
            </ul>

            <h2>7. Your content and license</h2>
            <p>
              You retain ownership of data and content you submit. You grant us a worldwide,
              non-exclusive license to host, copy, transmit, and display that content solely to
              operate, improve, and secure the Service. You represent that you have the rights
              necessary to grant this license.
            </p>

            <h2>8. Our intellectual property</h2>
            <p>
              The Service, including software, design, and documentation, is owned by {PRODUCT_NAME}{' '}
              and its licensors. These Terms do not grant you any right to our trademarks or brand
              except as needed to use the Service in the ordinary course.
            </p>

            <h2>9. Third-party services</h2>
            <p>
              The Service integrates with third parties such as Supabase, Stripe, Resend, Google,
              and Vercel as described in our <Link href="/privacy">Privacy Policy</Link>. Your use
              of those features may also be subject to the third party&apos;s terms. We are not
              responsible for third-party services we do not control.
            </p>

            <h2>10. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM
              EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
              GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION.
            </p>

            <h2>11. Limitation of liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, {PRODUCT_NAME} AND ITS SUPPLIERS WILL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
              ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR ANY CLAIM
              ARISING OUT OF THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A) AMOUNTS
              YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED
              U.S. DOLLARS ($100). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN THOSE
              CASES, OUR LIABILITY IS LIMITED TO THE FULLEST EXTENT PERMITTED BY LAW.
            </p>

            <h2>12. Indemnification</h2>
            <p>
              You will defend and indemnify {PRODUCT_NAME} against claims arising from your content,
              your use of the Service, or your violation of these Terms or applicable law, except
              to the extent caused by our gross negligence or willful misconduct.
            </p>

            <h2>13. Suspension and termination</h2>
            <p>
              We may suspend or terminate access if you breach these Terms, fail to pay fees, or
              pose a security risk. You may stop using the Service at any time. Sections that by
              their nature should survive (including payment obligations, disclaimers, limitation
              of liability, and indemnity) will survive termination.
            </p>

            <h2>14. Governing law and disputes</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, United States, without
              regard to conflict-of-law rules. Disputes will be resolved in the state or federal
              courts located in Delaware, unless applicable law requires otherwise. You may also
              have mandatory consumer rights in your home country that cannot be waived by contract.
            </p>

            <h2>15. Changes</h2>
            <p>
              We may modify these Terms by posting an updated version on this page. If changes are
              material, we will provide notice (for example, by email or in-product message) before
              they take effect. Continued use after the effective date constitutes acceptance.
            </p>

            <h2>16. Contact</h2>
            <p>
              Questions about these Terms:{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or our{' '}
              <Link href="/contact">contact page</Link>.
            </p>
          </article>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
