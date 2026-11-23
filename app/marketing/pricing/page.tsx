import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { PricingComparisonMatrix } from '@/components/marketing/PricingComparisonMatrix';
import { PricingTable } from '@/components/marketing/PricingTable';
import { getPlatformPricingDisplay } from '@/lib/billing/platformPricing';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import { buildPricingPageJsonLd } from '@/lib/marketing/seoJsonLd';
import { NO_ADD_ONS_PATH } from '@/lib/marketing/noAddOnComparison';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import styles from './pricing.module.scss';

const pageTitle = 'Pricing for cleaning businesses';
const pageDescription =
  'Simple pricing for residential and commercial cleaning businesses. Starter, Business, and Pro plans with a 7-day free trial — no credit card required.';

export const metadata: Metadata = buildMarketingPageMetadata({
  path: '/pricing',
  title: pageTitle,
  description: pageDescription,
});

export default async function PricingPage() {
  const tiers = await getPlatformPricingDisplay();
  const pricingJsonLd = buildPricingPageJsonLd(
    getPublicOrigin(null),
    tiers.map((tier) => ({
      tier: tier.tier,
      displayName: tier.displayName,
      monthlyPriceUsd: tier.monthlyPriceUsd,
    })),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />

      <MarketingNav />

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="md">
            <Stack gap={4} align="center">
              <span className={styles.eyebrow}>Transparent pricing</span>
              <h1 className={styles.title}>Plans that grow with your cleaning business</h1>
              <p className={styles.lead}>
                Every plan includes quotes, scheduling, invoicing, and core reports. Starter
                includes a day map and single-cleaner stop ordering. Business adds multi-cleaner
                dispatch. Pro adds re-optimization, multiple start locations, and drive-time
                reports. Upgrade your plan for customer portals, campaigns, payroll exports, or
                advanced analytics. Text packs are the only prepaid extra.{' '}
                <Link className={styles.inlineLink} href={NO_ADD_ONS_PATH}>
                  Compare plans with Jobber and Housecall Pro
                </Link>
                .
              </p>
            </Stack>
          </Container>
        </section>

        <section className={styles.pricingSection}>
          <Container size="lg">
            <PricingTable tiers={tiers} id="pricing" />
          </Container>
        </section>

        <section className={styles.compareSection}>
          <Container size="lg">
            <Stack gap={5}>
              <Stack gap={2} align="center" as="div">
                <h2 className={styles.sectionTitle}>Compare plans</h2>
                <p className={styles.sectionLead}>
                  Feature gates match what you see inside the app — no surprises after signup.
                </p>
              </Stack>
              <PricingComparisonMatrix />
            </Stack>
          </Container>
        </section>

        <section className={styles.ctaSection}>
          <Container size="md">
            <Stack gap={4} align="center">
              <h2 className={styles.ctaTitle}>Start your 7-day free trial</h2>
              <p className={styles.ctaLead}>
                No credit card required. Set up your workspace in minutes and see how Clean
                Scheduler fits your team.
              </p>
              <Button size="lg" href="/start-trial" as="a" iconRight={<ArrowRight size={18} />}>
                Start free trial
              </Button>
            </Stack>
          </Container>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
