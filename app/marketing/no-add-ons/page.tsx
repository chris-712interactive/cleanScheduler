import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { NoAddOnComparison } from '@/components/marketing/NoAddOnComparison';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import {
  COMPETITOR_PRICING_DISCLAIMER,
  NO_ADD_ONS_HEADLINE,
  NO_ADD_ONS_PATH,
  textPackIncludedNote,
} from '@/lib/marketing/noAddOnComparison';
import styles from './no-add-ons.module.scss';

const pageTitle = 'Features included in the plan';
const pageDescription =
  'Clean Scheduler includes features in Starter, Business, and Pro with no add-on fees. Compare monthly price, per-user fees, routing, dispatch, and online booking with Jobber and Housecall Pro.';

export const metadata: Metadata = buildMarketingPageMetadata({
  path: NO_ADD_ONS_PATH,
  title: pageTitle,
  description: pageDescription,
});

export default function NoAddOnsPage() {
  return (
    <>
      <MarketingNav />

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="md">
            <Stack gap={4} align="center">
              <span className={styles.eyebrow}>Plans, not add-ons</span>
              <h1 className={styles.title}>{NO_ADD_ONS_HEADLINE}</h1>
              <p className={styles.lead}>
                Clean Scheduler does not sell feature add-ons. Starter, Business, and Pro each
                include the features for that plan. {textPackIncludedNote()}
              </p>
            </Stack>
          </Container>
        </section>

        <section className={styles.tableSection} aria-labelledby="plan-comparison">
          <Container size="lg">
            <Stack gap={4}>
              <h2 id="plan-comparison" className={styles.sectionTitle}>
                Clean Scheduler, Jobber, and Housecall Pro
              </h2>
              <p className={styles.sectionLead}>
                Clean Scheduler cells list the plan that includes the feature. Competitor cells
                use published pricing pages, or say when a figure varies.
              </p>
              <div className={styles.tableWrap}>
                <NoAddOnComparison />
              </div>
              <p className={styles.disclaimer}>{COMPETITOR_PRICING_DISCLAIMER}</p>
            </Stack>
          </Container>
        </section>

        <section className={styles.ctaSection}>
          <Container size="md">
            <Stack gap={4} align="center">
              <h2 className={styles.ctaTitle}>See the plans</h2>
              <p className={styles.ctaLead}>
                Start a 7-day free trial with no credit card, or review Starter, Business, and Pro
                on the pricing page.
              </p>
              <div className={styles.actions}>
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
      </main>

      <MarketingFooter />
    </>
  );
}
