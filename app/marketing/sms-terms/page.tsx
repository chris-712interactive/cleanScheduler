import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import { LEGAL_LAST_UPDATED, PRODUCT_NAME } from '@/lib/legal/site';
import styles from '../legal.module.scss';

export const metadata = buildMarketingPageMetadata({
  path: '/sms-terms',
  title: 'SMS Terms & Conditions',
  description: `SMS messaging terms for ${PRODUCT_NAME} account and booking notifications.`,
});

export default function SmsTermsPage() {
  return (
    <>
      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="SMS Terms & Conditions"
            description="How text messaging consent, delivery, and opt-out controls work."
            backHref="/"
            backLabel="Home"
          />

          <article className={styles.doc}>
            <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>

            <h2>Program description</h2>
            <p>
              By opting in, you agree to receive transactional text messages from {PRODUCT_NAME}{' '}
              related to your bookings and account updates.
            </p>

            <h2>Message frequency</h2>
            <p>Message frequency varies based on your bookings and account activity.</p>

            <h2>Message and data rates</h2>
            <p>Message and data rates may apply based on your wireless carrier plan.</p>

            <h2>Opt-out and help</h2>
            <p>
              You can opt out at any time by replying <strong>STOP</strong>. Reply{' '}
              <strong>HELP</strong> for help.
            </p>

            <h2>Privacy</h2>
            <p>
              Your use of SMS notifications is also subject to our{' '}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </article>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
