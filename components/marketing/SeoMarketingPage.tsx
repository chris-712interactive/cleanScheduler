import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { FinalCta } from '@/components/marketing/FinalCta';
import { buildFaqJsonLd } from '@/lib/marketing/faqJsonLd';
import type { SeoMarketingPage as SeoMarketingPageContent } from '@/lib/marketing/seoContent/types';
import styles from './SeoMarketingPage.module.scss';

export function SeoMarketingPage({ page }: { page: SeoMarketingPageContent }) {
  const faqJsonLd = page.faq.length > 0 ? buildFaqJsonLd(page.faq) : null;

  return (
    <>
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <MarketingNav />

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="md">
            <Stack gap={4} align="center">
              <span className={styles.eyebrow}>{page.eyebrow}</span>
              <h1 className={styles.title}>{page.headline}</h1>
              <p className={styles.lead}>{page.lead}</p>
              <div className={styles.heroActions}>
                <Button size="lg" href="/start-trial" as="a" iconRight={<ArrowRight size={18} />}>
                  Start free trial
                </Button>
                <Button size="lg" variant="secondary" as="a" href="/pricing">
                  View pricing
                </Button>
              </div>
            </Stack>
          </Container>
        </section>

        <section className={styles.content}>
          <Container size="md">
            <div className={styles.sections}>
              {page.sections.map((section) => (
                <article key={section.title} className={styles.section}>
                  <h2 className={styles.sectionTitle}>{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className={styles.sectionParagraph}>
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets ? (
                    <ul className={styles.sectionList}>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                  {section.link ? (
                    <Link href={section.link.href} className={styles.sectionLink}>
                      {section.link.label} →
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </Container>
        </section>

        {page.relatedLinks.length > 0 ? (
          <section className={styles.related} aria-labelledby="related-pages">
            <Container size="md">
              <h2 id="related-pages" className={styles.relatedTitle}>
                Related pages
              </h2>
              <ul className={styles.relatedList}>
                {page.relatedLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={styles.relatedLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        ) : null}

        {page.faq.length > 0 ? (
          <section className={styles.faqSection} id="faq">
            <Container size="md">
              <Stack gap={6}>
                <Stack gap={2} align="center" as="div">
                  <h2 className={styles.faqTitle}>Common questions</h2>
                  <p className={styles.faqLead}>
                    Straight answers for cleaning business owners evaluating Clean Scheduler.
                  </p>
                </Stack>
                <div className={styles.faqList}>
                  {page.faq.map((item) => (
                    <details key={item.question} className={styles.faqItem}>
                      <summary className={styles.faqQuestion}>{item.question}</summary>
                      <p className={styles.faqAnswer}>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </Stack>
            </Container>
          </section>
        ) : null}

        <FinalCta title={page.ctaTitle} lead={page.ctaLead} />
      </main>

      <MarketingFooter />
    </>
  );
}
