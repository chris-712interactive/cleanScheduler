import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import styles from './Faq.module.scss';

export interface FaqProps {
  items: MarketingFaqItem[];
  id?: string;
}

export function Faq({ items, id = 'faq' }: FaqProps) {
  return (
    <section className={styles.section} id={id}>
      <Container size="md">
        <Stack gap={6}>
          <Stack gap={2} align="center" as="div">
            <h2 className={styles.title}>Frequently asked questions</h2>
            <p className={styles.lead}>
              Straight answers for cleaning business owners evaluating Clean Scheduler.
            </p>
          </Stack>
          <div className={styles.list}>
            {items.map((item) => (
              <details key={item.question} className={styles.item}>
                <summary className={styles.question}>{item.question}</summary>
                <p className={styles.answer}>{item.answer}</p>
              </details>
            ))}
          </div>
        </Stack>
      </Container>
    </section>
  );
}
