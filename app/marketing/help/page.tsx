import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { buildHelpPageMetadata } from '@/lib/help/metadata';
import { HELP_HUB_CATEGORIES, HELP_HUB_LINKS } from '@/lib/help/registry';
import styles from '@/components/marketing/help/help.module.scss';

export const metadata = buildHelpPageMetadata({
  path: '/help',
  title: 'Help Center',
  description: 'Public documentation for customers, developers, and compliance reviewers.',
});

export default function HelpIndexPage() {
  return (
    <main className={styles.page}>
      <Container size="md">
        <PageHeader
          title="Help Center"
          description="Documentation for customers, developers, and compliance reviewers."
          backHref="/"
          backLabel="Home"
        />

        <section className={styles.section}>
          <h2>Browse by audience</h2>
          <div className={styles.grid}>
            {HELP_HUB_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={category.path}
                className={[styles.card, styles.cardLink].join(' ')}
              >
                <h3>{category.title}</h3>
                <p>{category.description}</p>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>
                    {category.audience === 'customers'
                      ? 'Customers'
                      : category.audience === 'developers'
                        ? 'Developers'
                        : 'Compliance'}
                  </span>
                </div>
                <p className={styles.cardLinkText}>Open section</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>General</h2>
          <div className={styles.grid}>
            {HELP_HUB_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={[styles.card, styles.cardLink].join(' ')}
              >
                <h3>{link.title}</h3>
                <p>{link.description}</p>
                <div className={styles.badgeRow}>
                  {link.badges.map((badge) => (
                    <span key={badge.label} className={styles.badge}>
                      {badge.label}
                    </span>
                  ))}
                </div>
                <p className={styles.cardLinkText}>Open page</p>
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}
