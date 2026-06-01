import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import styles from './FinalCta.module.scss';

export interface FinalCtaProps {
  title?: string;
  lead?: string;
}

export function FinalCta({
  title = 'Ready to tidy up your operations?',
  lead = 'Join cleaning businesses using Clean Scheduler to schedule crews, close quotes, and get paid faster.',
}: FinalCtaProps) {
  return (
    <section className={styles.section}>
      <Container size="md">
        <Stack gap={4} align="center">
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.lead}>{lead}</p>
          <div className={styles.actions}>
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
  );
}
