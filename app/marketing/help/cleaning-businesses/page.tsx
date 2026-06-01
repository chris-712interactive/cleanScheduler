import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { buildHelpPageMetadata } from '@/lib/help/metadata';
import { CLEANING_BUSINESS_ARTICLES, CLEANING_BUSINESS_HUB } from '@/lib/marketing/seoContent';
import styles from '@/components/marketing/help/help.module.scss';

export const metadata = buildHelpPageMetadata({
  path: CLEANING_BUSINESS_HUB.path,
  title: CLEANING_BUSINESS_HUB.title,
  description: CLEANING_BUSINESS_HUB.description,
});

export default function CleaningBusinessHelpHubPage() {
  return (
    <main className={styles.page}>
      <Container size="md">
        <PageHeader
          title={CLEANING_BUSINESS_HUB.title}
          description={CLEANING_BUSINESS_HUB.description}
          backHref="/help"
          backLabel="Help Center"
          breadcrumbs={[{ label: 'Help', href: '/help' }, { label: 'Cleaning businesses' }]}
        />

        <section className={styles.section}>
          <h2>{CLEANING_BUSINESS_HUB.sectionTitle}</h2>
          <div className={styles.grid}>
            {CLEANING_BUSINESS_ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={article.path}
                className={[styles.card, styles.cardLink].join(' ')}
              >
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>How-to</span>
                  <span className={styles.badge}>Owners</span>
                </div>
                <p className={styles.cardLinkText}>Read guide</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>Explore solutions</h2>
          <div className={styles.grid}>
            <Link
              href="/for/residential-cleaning-companies"
              className={[styles.card, styles.cardLink].join(' ')}
            >
              <h3>Residential cleaning software</h3>
              <p>Quotes, recurring schedules, and invoicing for home cleaning companies.</p>
              <p className={styles.cardLinkText}>Open page</p>
            </Link>
            <Link
              href="/for/commercial-cleaning-companies"
              className={[styles.card, styles.cardLink].join(' ')}
            >
              <h3>Commercial cleaning software</h3>
              <p>Multi-site accounts, crew scheduling, and month-end AR for janitorial teams.</p>
              <p className={styles.cardLinkText}>Open page</p>
            </Link>
            <Link href="/why-cleanscheduler" className={[styles.card, styles.cardLink].join(' ')}>
              <h3>Why Clean Scheduler</h3>
              <p>How owners, office managers, and bookkeepers use one workspace.</p>
              <p className={styles.cardLinkText}>Open page</p>
            </Link>
          </div>
        </section>
      </Container>
    </main>
  );
}
