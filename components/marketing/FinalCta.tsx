import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import styles from './FinalCta.module.scss';

export interface FinalCtaProps {
  title?: string;
  lead?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function FinalCta({
  title = 'Ready to tidy up your operations?',
  lead = 'Join cleaning businesses using Clean Scheduler to schedule crews, close quotes, and get paid faster.',
  primaryHref = '/start-trial',
  primaryLabel = 'Start your free trial',
  secondaryHref = '/contact',
  secondaryLabel = 'Contact sales',
}: FinalCtaProps) {
  return (
    <section className={styles.section}>
      <Container size="md">
        <Stack gap={4} align="center">
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.lead}>{lead}</p>
          <div className={styles.actions}>
            <Button size="lg" href={primaryHref} as="a" iconRight={<ArrowRight size={18} />}>
              {primaryLabel}
            </Button>
            {secondaryHref ? (
              <Button size="lg" variant="secondary" as="a" href={secondaryHref}>
                {secondaryLabel}
              </Button>
            ) : null}
          </div>
        </Stack>
      </Container>
    </section>
  );
}
