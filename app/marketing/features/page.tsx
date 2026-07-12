import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { FinalCta } from '@/components/marketing/FinalCta';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { buildFeatureHubJsonLd } from '@/lib/marketing/seoJsonLd';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import { FEATURE_PAGES } from '@/lib/marketing/seoContent';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import styles from '@/components/marketing/SeoMarketingPage.module.scss';

const pageTitle = 'Cleaning business software features';
const pageDescription =
  'Cleaning scheduling software, online payments, cleaning company software with Stripe integration, crew scheduling, mobile app for cleaning employees, and more — built for residential and commercial cleaning companies.';

export const metadata: Metadata = buildMarketingPageMetadata({
  path: '/features',
  title: pageTitle,
  description: pageDescription,
});

export default function FeaturesHubPage() {
  const featureHubJsonLd = buildFeatureHubJsonLd(FEATURE_PAGES, getPublicOrigin(null), {
    title: pageTitle,
    description: pageDescription,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(featureHubJsonLd) }}
      />

      <MarketingNav />

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="md">
            <Stack gap={4} align="center">
              <span className={styles.eyebrow}>Features</span>
              <h1 className={styles.title}>Software features for cleaning businesses</h1>
              <p className={styles.lead}>
                From cleaning scheduling software and crew assignment to online payments and Stripe
                integration — explore how Clean Scheduler supports residential and commercial
                cleaning teams.
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
              {FEATURE_PAGES.map((page) => (
                <article key={page.slug} className={styles.section}>
                  <h2 className={styles.sectionTitle}>{page.headline}</h2>
                  <p className={styles.sectionParagraph}>{page.lead}</p>
                  <Link href={page.path} className={styles.sectionLink}>
                    Read full feature page →
                  </Link>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <FinalCta
          title="Try Clean Scheduler on your own routes"
          lead="Start a 7-day free trial — no credit card required — and run your next quote, visit, and invoice in one workspace."
        />
      </main>

      <MarketingFooter />
    </>
  );
}
