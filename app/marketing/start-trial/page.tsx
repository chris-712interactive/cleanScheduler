import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { publicEnv } from '@/lib/env';
import { TenantOnboardingForm } from '../onboarding/TenantOnboardingForm';
import styles from './start-trial.module.scss';

export default function StartTrialPage() {
  const domainSuffix = publicEnv.NEXT_PUBLIC_APP_DOMAIN;

  return (
    <>
      <header className={styles.header}>
        <Container>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true">
                cs
              </span>
              cleanScheduler
            </Link>
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main className={styles.page}>
        <Container size="md">
          <Card
            title="Start your 7-day free trial"
            description="Three quick steps: workspace setup, owner account, and launch preferences."
          >
            <TenantOnboardingForm domainSuffix={domainSuffix} />
          </Card>
        </Container>
      </main>
    </>
  );
}
