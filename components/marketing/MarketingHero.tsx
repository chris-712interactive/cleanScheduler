import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { ProductScreenshot } from '@/components/marketing/ProductScreenshot';
import styles from './MarketingHero.module.scss';

export interface MarketingHeroProps {
  eyebrow: string;
  title: string;
  lead: string;
  note: string;
}

export function MarketingHero({ eyebrow, title, lead, note }: MarketingHeroProps) {
  return (
    <section className={styles.hero}>
      <Container size="lg">
        <div className={styles.grid}>
          <Stack gap={5} align="start">
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lead}>{lead}</p>
            <div className={styles.actions}>
              <Button size="lg" href="/start-trial" as="a" iconRight={<ArrowRight size={18} />}>
                Start your free trial
              </Button>
              <Button size="lg" variant="secondary" as="a" href="/pricing">
                See pricing
              </Button>
            </div>
            <p className={styles.note}>{note}</p>
          </Stack>
          <ProductScreenshot
            src="/marketing/hero-dashboard.png"
            alt="Clean Scheduler dashboard showing today's jobs, quotes, outstanding invoices, and active customers"
            priority
          />
        </div>
      </Container>
    </section>
  );
}
