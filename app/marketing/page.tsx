import { ArrowRight, Calendar, ClipboardList, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/layout/Container';
import { Grid } from '@/components/layout/Grid';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import styles from './landing.module.scss';

export default function MarketingHome() {
  return (
    <>
      <header className={styles.header}>
        <Container>
          <div className={styles.headerInner}>
            <span className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true">
                cs
              </span>
              cleanScheduler
            </span>
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <Container size="md">
            <Stack gap={5} align="start">
              <span className={styles.eyebrow}>Built for cleaning businesses</span>
              <h1 className={styles.heroTitle}>
                Schedule, quote, bill, and grow - all from one tidy console.
              </h1>
              <p className={styles.heroLead}>
                cleanScheduler is the multi-tenant scheduling, billing, and customer
                portal stack for residential and commercial cleaning teams. Manage
                jobs, get paid faster, and give every customer a clear, branded view
                of their service.
              </p>
              <div className={styles.heroActions}>
                <Button size="lg" href="/start-trial" as="a" iconRight={<ArrowRight size={18} />}>
                  Start your free trial
                </Button>
                <Button size="lg" variant="secondary" as="a" href="/contact">
                  Contact sales
                </Button>
              </div>
            </Stack>
          </Container>
        </section>

        <section className={styles.features}>
          <Container>
            <Stack gap={6}>
              <Stack gap={2} align="center" as="div">
                <h2 className={styles.sectionTitle}>Everything in one workspace</h2>
                <p className={styles.sectionLead}>
                  Three portals - one for your team, one for each tenant, one for
                  every customer - sharing a clean, consistent design system.
                </p>
              </Stack>

              <Grid min="280px" gap={4}>
                <Card
                  title="Smart scheduling"
                  description="Drag-and-drop calendar, recurring services, and route-aware day views."
                >
                  <div className={styles.featureIcon} aria-hidden="true">
                    <Calendar size={20} />
                  </div>
                </Card>
                <Card
                  title="Quotes that close"
                  description="Branded estimates with line items, photos, and one-click acceptance."
                >
                  <div className={styles.featureIcon} aria-hidden="true">
                    <ClipboardList size={20} />
                  </div>
                </Card>
                <Card
                  title="Payments without the chase"
                  description="Cards, ACH, Zelle, and check tracking with built-in reconciliation."
                >
                  <div className={styles.featureIcon} aria-hidden="true">
                    <ShieldCheck size={20} />
                  </div>
                </Card>
              </Grid>
            </Stack>
          </Container>
        </section>

      </main>

      <footer className={styles.footer}>
        <Container>
          <p className={styles.footerCopy}>
            (c) {new Date().getFullYear()} cleanScheduler. All rights reserved.
          </p>
        </Container>
      </footer>
    </>
  );
}
