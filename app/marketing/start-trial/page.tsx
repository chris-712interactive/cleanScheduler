import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { publicEnv } from '@/lib/env';
import { TenantOnboardingForm } from '../onboarding/TenantOnboardingForm';
import styles from './start-trial.module.scss';

export default async function StartTrialPage() {
  const domainSuffix = publicEnv.NEXT_PUBLIC_APP_DOMAIN;

  return (
    <>
      <MarketingNav />

      <main className={styles.page}>
        <Container size="md">
          <Card
            title="Start your 7-day free trial"
            description="Two quick steps: workspace and your account. No credit card required — choose a plan when you subscribe."
          >
            <TenantOnboardingForm domainSuffix={domainSuffix} />
          </Card>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
