import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { FinalCta } from '@/components/marketing/FinalCta';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { buildCompareHubJsonLd } from '@/lib/marketing/seoJsonLd';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import { COMPARE_PAGES } from '@/lib/marketing/seoContent';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import styles from '@/components/marketing/SeoMarketingPage.module.scss';

const pageTitle = 'Compare cleaning business software';
const pageDescription =
  'Compare cleaning business software: Clean Scheduler vs Jobber, ZenMaid, Housecall Pro, Launch27, Swept, spreadsheets, and generic field service tools. Honest pros, cons, and pricing.';

export const metadata: Metadata = buildMarketingPageMetadata({
  path: '/compare',
  title: pageTitle,
  description: pageDescription,
});

export default function CompareHubPage() {
  const compareHubJsonLd = buildCompareHubJsonLd(COMPARE_PAGES, getPublicOrigin(null), {
    title: pageTitle,
    description: pageDescription,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareHubJsonLd) }}
      />

      <MarketingNav />

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="md">
            <Stack gap={4} align="center">
              <span className={styles.eyebrow}>Compare</span>
              <h1 className={styles.title}>Compare cleaning business software</h1>
              <p className={styles.lead}>
                Straightforward comparisons for cleaning business owners evaluating scheduling,
                payments, and Stripe-ready software — including when a competitor might still be the
                better fit.
              </p>
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
              {COMPARE_PAGES.map((page) => (
                <article key={page.slug} className={styles.section}>
                  <h2 className={styles.sectionTitle}>{page.headline}</h2>
                  <p className={styles.sectionParagraph}>{page.lead}</p>
                  <Link href={page.path} className={styles.sectionLink}>
                    Read full comparison →
                  </Link>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <FinalCta
          title="Try Clean Scheduler on your own books"
          lead="Start a 7-day free trial — no credit card required — and compare the workflow side by side with your current tool."
        />
      </main>

      <MarketingFooter />
    </>
  );
}
