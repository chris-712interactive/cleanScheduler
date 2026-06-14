import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { buildHelpPageMetadata } from '@/lib/help/metadata';
import { NOINDEX_PAGE_METADATA } from '@/lib/marketing/marketingPageMetadata';
import {
  CUSTOMER_HELP_ARTICLES,
  CUSTOMER_HELP_HUB,
} from '@/lib/marketing/seoContent/customerHelpArticles';
import styles from '@/components/marketing/help/help.module.scss';

export const metadata = {
  ...buildHelpPageMetadata({
    path: CUSTOMER_HELP_HUB.path,
    title: CUSTOMER_HELP_HUB.title,
    description: CUSTOMER_HELP_HUB.description,
  }),
  ...NOINDEX_PAGE_METADATA,
};

export default function CustomerHelpPage() {
  return (
    <main className={styles.page}>
      <Container size="md">
        <PageHeader
          title={CUSTOMER_HELP_HUB.title}
          description={CUSTOMER_HELP_HUB.description}
          backHref="/help"
          backLabel="Help Center"
          breadcrumbs={[{ label: 'Help', href: '/help' }, { label: 'Customers' }]}
        />

        <section className={styles.section}>
          <h2>{CUSTOMER_HELP_HUB.sectionTitle}</h2>
          <div className={styles.grid}>
            <Link href="/help/tcr" className={[styles.card, styles.cardLink].join(' ')}>
              <h3>Get started with your portal</h3>
              <p>Accept invite, create password, and enable SMS updates.</p>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>Public</span>
                <span className={styles.badge}>How-to</span>
              </div>
              <p className={styles.cardLinkText}>SMS opt-in and compliance details</p>
            </Link>

            {CUSTOMER_HELP_ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={article.path}
                className={[styles.card, styles.cardLink].join(' ')}
              >
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>How-to</span>
                </div>
                <p className={styles.cardLinkText}>Read guide</p>
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}
