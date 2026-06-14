import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';
import { publicEnv } from '@/lib/env';
import { TenantOnboardingForm } from '../onboarding/TenantOnboardingForm';
import styles from './start-trial.module.scss';

export const metadata: Metadata = buildMarketingPageMetadata({
  path: '/start-trial',
  title: 'Start your 7-day free trial',
  description:
    'Create your Clean Scheduler workspace in minutes. No credit card required — quotes, scheduling, and invoicing for cleaning businesses.',
});

export default async function StartTrialPage() {
  const domainSuffix = publicEnv.NEXT_PUBLIC_APP_DOMAIN;

  return (
    <>
      <MarketingNav />

      <main className={styles.page}>
        <Container size="md">
          <Card
            title="Start your 7-day free trial"
            description="Three quick steps: workspace, your details, and a password. No credit card required — choose a plan when you subscribe."
          >
            <TenantOnboardingForm domainSuffix={domainSuffix} />
          </Card>
        </Container>
      </main>

      <MarketingFooter />
    </>
  );
}
