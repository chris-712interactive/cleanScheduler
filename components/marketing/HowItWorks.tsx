import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import styles from './HowItWorks.module.scss';

type Step = {
  step: number;
  title: string;
  description: string;
};

export interface HowItWorksProps {
  steps: Step[];
  id?: string;
}

export function HowItWorks({ steps, id = 'how-it-works' }: HowItWorksProps) {
  return (
    <section className={styles.section} id={id}>
      <Container size="md">
        <Stack gap={6}>
          <Stack gap={2} align="center" as="div">
            <h2 className={styles.title}>Up and running in minutes</h2>
            <p className={styles.lead}>
              Start with quotes and scheduling. Add payments and reports when your team is ready.
            </p>
          </Stack>
          <ol className={styles.steps}>
            {steps.map((item) => (
              <li key={item.step}>
                <span className={styles.stepNumber} aria-hidden>
                  {item.step}
                </span>
                <div className={styles.stepCopy}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </div>
              </li>
            ))}
          </ol>
        </Stack>
      </Container>
    </section>
  );
}
