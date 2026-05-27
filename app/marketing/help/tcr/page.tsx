import Link from 'next/link';
import Image from 'next/image';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from './page.module.scss';

export const metadata = {
  title: `TCR Documentation · ${PRODUCT_NAME}`,
  description:
    'Public TCR compliance documentation covering SMS terms, privacy policy, and customer opt-in disclosures.',
};

export default function TcrDocumentationPage() {
  return (
    <>
      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="TCR Documentation"
            description="Public documentation and screenshots used for The Campaign Registry (10DLC) review."
            backHref="/"
            backLabel="Home"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>

            <h2>Public compliance URLs</h2>
            <ul>
              <li>
                Privacy Policy: <Link href="/privacy">/privacy</Link>
              </li>
              <li>
                SMS Terms &amp; Conditions: <Link href="/sms-terms">/sms-terms</Link>
              </li>
            </ul>

            <h2>Campaign setup</h2>
            <ul>
              <li>
                <strong>Brand Name:</strong> Clean Scheduler
              </li>
              <li>
                <strong>Campaign Type:</strong> Low Volume Mixed (Transactional)
              </li>
              <li>
                <strong>Audience:</strong> Homeowners (customers) and cleaning service providers
              </li>
              <li>
                <strong>Opt-in method:</strong> Account signup at cleanscheduler.com
              </li>
            </ul>

            <h2>SMS consent disclosure used at opt-in</h2>
            <p className={styles.disclosure}>
              I agree to receive text messages from {PRODUCT_NAME} about my bookings and account.
              Message frequency varies based on your bookings. Message and data rates may apply.
              Reply STOP to unsubscribe. Reply HELP for help. View our Privacy Policy and Terms
              &amp; Conditions.
            </p>

            <h2>Customer opt-in flow proof</h2>
            <ul>
              <li>
                Opt-in is collected during customer account signup from invite completion (
                <code>/complete-invite</code> on the customer portal).
              </li>
              <li>
                Consent uses an explicit unchecked checkbox with clear disclosure language, including
                STOP and HELP instructions, rate notice, and links to{' '}
                <Link href="/privacy">Privacy Policy</Link> and <Link href="/sms-terms">SMS Terms</Link>.
              </li>
              <li>
                Phone number is required when SMS opt-in is selected; submission is rejected without
                a number.
              </li>
              <li>
                Consent is stored to profile fields for auditability:
                <code>sms_transactional_opt_in</code> and <code>sms_transactional_opt_in_at</code>.
              </li>
            </ul>

            <h2>Required keyword auto-responses</h2>
            <p>Configured responses for mandatory TCR keywords:</p>
            <ol>
              <li>
                <strong>STOP:</strong> Clean Scheduler: You have been unsubscribed and will receive
                no further messages.
              </li>
              <li>
                <strong>HELP:</strong> Clean Scheduler: For support, visit cleanscheduler.com/help
                or email support@cleanscheduler.com.
              </li>
              <li>
                <strong>START:</strong> Clean Scheduler: You&apos;re subscribed to booking and
                account notifications. Msg&amp;data rates may apply. Reply STOP to opt out, HELP
                for help.
              </li>
            </ol>

            <h2>TCR campaign description</h2>
            <blockquote className={styles.blockquote}>
              &quot;Clean Scheduler sends transactional SMS notifications to homeowners and cleaning
              service providers who have opted in at account signup. Messages include cleaning quote
              delivery, booking confirmations, job decline notifications, appointment reminders, and
              invoice payment reminders. No promotional content is included.&quot;
            </blockquote>

            <h2>Message templates</h2>
            <p>
              Variables in brackets are populated dynamically at send time. Brand prefix and opt-out
              language remain fixed for review consistency.
            </p>
            <ol className={styles.templates}>
              <li>
                <strong>Quote Sent (to Customer)</strong>
                <p>
                  Clean Scheduler: Hi [FirstName], your cleaning quote for [ServiceDate] is ready.
                  Est. $[Amount] for [ServiceType]. View details: cleanscheduler.com/quotes/[QuoteID]
                  Reply STOP to opt out. (152 characters)
                </p>
              </li>
              <li>
                <strong>Quote Accepted (to Customer)</strong>
                <p>
                  Clean Scheduler: Great news, [FirstName]! Your cleaning on [ServiceDate] at [Time]
                  is confirmed. Your cleaner will arrive at [Address]. Reply STOP to opt out. (148
                  characters)
                </p>
              </li>
              <li>
                <strong>Quote Accepted (to Service Provider)</strong>
                <p>
                  Clean Scheduler: Hi [FirstName], a new job is confirmed. Customer: [CustomerName],
                  [ServiceDate] at [Time], [Address]. View details: cleanscheduler.com/jobs/[JobID]
                  Reply STOP to opt out. (155 characters)
                </p>
              </li>
              <li>
                <strong>Quote Declined (to Customer)</strong>
                <p>
                  Clean Scheduler: Hi [FirstName], your cleaning quote for [ServiceDate] has been
                  declined. Request a new quote anytime: cleanscheduler.com/quotes Reply STOP to opt
                  out. (150 characters)
                </p>
              </li>
              <li>
                <strong>Quote Declined (to Service Provider)</strong>
                <p>
                  Clean Scheduler: Hi [FirstName], the quote for [ServiceDate] at [Address] was not
                  accepted by the customer. Check your dashboard: cleanscheduler.com/dashboard Reply
                  STOP to opt out. (152 characters)
                </p>
              </li>
              <li>
                <strong>Cleaning Visit Reminder (to Customer)</strong>
                <p>
                  Clean Scheduler: Reminder, [FirstName] - your cleaning is tomorrow, [ServiceDate]
                  at [Time]. Questions? Reply or visit cleanscheduler.com/bookings/[BookingID] Reply
                  STOP to opt out. (155 characters)
                </p>
              </li>
              <li>
                <strong>Invoice Overdue (to Customer)</strong>
                <p>
                  Clean Scheduler: Hi [FirstName], invoice #[InvoiceID] for $[Amount] is past due.
                  Pay now: cleanscheduler.com/pay/[InvoiceID] Reply STOP to opt out. (120
                  characters)
                </p>
              </li>
            </ol>

            <h2>Evidence screenshots</h2>
            <p>
              These screenshots are captured from live public routes and stored at{' '}
              <code>/public/help/tcr</code>.
            </p>

            <section className={styles.evidence} aria-label="TCR evidence screenshots">
              <figure className={styles.figure}>
                <Image
                  src="/help/tcr/privacy-policy.png"
                  alt="Privacy policy public page"
                  width={1280}
                  height={720}
                />
                <figcaption>
                  Privacy policy page used for TCR review evidence (<code>/privacy</code>).
                </figcaption>
              </figure>

              <figure className={styles.figure}>
                <Image
                  src="/help/tcr/sms-terms.png"
                  alt="SMS terms public page"
                  width={1280}
                  height={720}
                />
                <figcaption>
                  SMS terms and opt-out language page used for TCR review evidence (
                  <code>/sms-terms</code>).
                </figcaption>
              </figure>

              <figure className={styles.figure}>
                <Image
                  src="/help/tcr/customer-opt-in-flow-proof.png"
                  alt="Customer opt-in flow proof section in TCR documentation"
                  width={1280}
                  height={1083}
                />
                <figcaption>
                  Supporting documentation snapshot for customer opt-in flow requirements,
                  disclosures, and auditability controls.
                </figcaption>
              </figure>
            </section>
          </article>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
