import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { getPlatformPricingDisplay } from '@/lib/billing/platformPricing';
import { parsePlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { publicEnv } from '@/lib/env';
import { TenantOnboardingForm } from '../onboarding/TenantOnboardingForm';
import styles from './start-trial.module.scss';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StartTrialPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const domainSuffix = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const tiers = await getPlatformPricingDisplay();
  const requestedTier = parsePlatformPlanTier(firstParam(params.tier));
  const defaultTier = requestedTier ?? 'business';

  return (
    <>
      <MarketingNav />

      <main className={styles.page}>
        <Container size="md">
          <Card
            title="Start your 7-day free trial"
            description="Three quick steps: workspace setup, owner account, and launch preferences. No credit card required."
          >
            <TenantOnboardingForm
              domainSuffix={domainSuffix}
              planOptions={tiers}
              defaultTier={defaultTier}
            />
          </Card>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
