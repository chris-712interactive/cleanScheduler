import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { buildHelpPageMetadata } from '@/lib/help/metadata';
import { buildHomePageJsonLd } from '@/lib/marketing/seoJsonLd';
import { HELP_CENTER_FAQ } from '@/lib/marketing/homepageContent';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import styles from '@/components/marketing/help/help.module.scss';

export const metadata = buildHelpPageMetadata({
  path: '/help/faq',
  title: 'FAQ',
  description:
    'Frequently asked questions about Clean Scheduler trials, billing, Stripe integration, commercial scheduling, and features.',
});

export default function HelpFaqPage() {
  const jsonLd = buildHomePageJsonLd(getPublicOrigin(null), HELP_CENTER_FAQ, {
    title: 'Clean Scheduler FAQ',
    description:
      'Frequently asked questions about Clean Scheduler trials, billing, Stripe integration, commercial scheduling, and features.',
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title="Frequently asked questions"
            description="Straight answers for cleaning business owners evaluating Clean Scheduler."
            backHref="/help"
            backLabel="Help Center"
            breadcrumbs={[{ label: 'Help', href: '/help' }, { label: 'FAQ' }]}
          />

          <div className={styles.faqList}>
            {HELP_CENTER_FAQ.map((item) => (
              <details key={item.question} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>{item.question}</summary>
                <p className={styles.faqAnswer}>{item.answer}</p>
              </details>
            ))}
          </div>

          <p className={styles.faqAnswer}>
            Still have questions? Visit our <Link href="/help/contact">contact page</Link>, read{' '}
            <Link href="/help/cleaning-businesses">owner guides</Link>, or{' '}
            <Link href="/contact">talk to sales</Link>.
          </p>
        </Container>
      </main>
    </>
  );
}
