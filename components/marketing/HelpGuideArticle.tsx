import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/portal/PageHeader';
import { buildFaqJsonLd } from '@/lib/marketing/faqJsonLd';
import type { HelpGuideArticle } from '@/lib/marketing/seoContent/types';
import styles from './HelpGuideArticle.module.scss';

export function HelpGuideArticle({ article }: { article: HelpGuideArticle }) {
  const faqJsonLd = article.faq.length > 0 ? buildFaqJsonLd(article.faq) : null;

  return (
    <>
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <main className={styles.page}>
        <Container size="md">
          <PageHeader
            title={article.title}
            description={article.description}
            backHref="/help/cleaning-businesses"
            backLabel="Guides for cleaning businesses"
            breadcrumbs={[
              { label: 'Help', href: '/help' },
              { label: 'Cleaning businesses', href: '/help/cleaning-businesses' },
              { label: article.title },
            ]}
          />

          <div className={styles.sections}>
            {article.sections.map((section) => (
              <section key={section.title} className={styles.section}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className={styles.paragraph}>
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className={styles.list}>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                {section.tip ? <p className={styles.tip}>{section.tip}</p> : null}
              </section>
            ))}
          </div>

          {article.faq.length > 0 ? (
            <section className={styles.faqBlock} aria-labelledby="guide-faq">
              <h2 id="guide-faq" className={styles.faqHeading}>
                FAQ
              </h2>
              <div className={styles.faqList}>
                {article.faq.map((item) => (
                  <details key={item.question} className={styles.faqItem}>
                    <summary className={styles.faqQuestion}>{item.question}</summary>
                    <p className={styles.faqAnswer}>{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {article.relatedLinks.length > 0 ? (
            <nav className={styles.related} aria-label="Related pages">
              <h2 className={styles.relatedTitle}>Related</h2>
              <ul className={styles.relatedList}>
                {article.relatedLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <div className={styles.cta}>
            <p className={styles.ctaLead}>
              Try these workflows in your workspace — free for 7 days.
            </p>
            <Button href="/start-trial" as="a" iconRight={<ArrowRight size={18} />}>
              Start free trial
            </Button>
          </div>
        </Container>
      </main>
    </>
  );
}
