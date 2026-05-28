import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/site';
import { buildHelpPageMetadata } from '@/lib/help/metadata';
import styles from '@/components/marketing/help/help.module.scss';

export const metadata = buildHelpPageMetadata({
  path: '/help/contact',
  title: 'Contact Support',
  description: 'How to reach cleanScheduler sales, support, and legal teams.',
});

export default function HelpContactPage() {
  return (
    <main className={styles.page}>
      <Container size="md">
        <PageHeader
          title="Contact support"
          description="Choose the right channel based on what you need help with."
          backHref="/help"
          backLabel="Help Center"
          breadcrumbs={[{ label: 'Help', href: '/help' }, { label: 'Contact' }]}
        />

        <ul className={styles.contactList}>
          <li>
            <strong>Sales and demos:</strong> Use our <Link href="/contact">contact form</Link> for
            pricing questions, product demos, and partnership inquiries.
          </li>
          <li>
            <strong>Product support:</strong> Email{' '}
            <a href="mailto:support@cleanscheduler.com">support@cleanscheduler.com</a> for account
            and platform help.
          </li>
          <li>
            <strong>Legal and privacy:</strong> Email{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> for privacy, data,
            and legal requests.
          </li>
          <li>
            <strong>SMS program help:</strong> Reply <strong>HELP</strong> to any message, or review
            our <Link href="/sms-terms">SMS terms</Link> and{' '}
            <Link href="/help/tcr">TCR documentation</Link>.
          </li>
          <li>
            <strong>End-customer service issues:</strong> Contact your cleaning service provider
            directly. They manage your bookings, invoices, and portal access.
          </li>
        </ul>
      </Container>
    </main>
  );
}
