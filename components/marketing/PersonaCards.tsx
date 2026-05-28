import { Container } from '@/components/layout/Container';
import { Grid } from '@/components/layout/Grid';
import { Card } from '@/components/ui/Card';
import type { MarketingPersona } from '@/lib/marketing/homepageContent';
import styles from './PersonaCards.module.scss';

export interface PersonaCardsProps {
  personas: MarketingPersona[];
}

export function PersonaCards({ personas }: PersonaCardsProps) {
  return (
    <section className={styles.section}>
      <Container>
        <Grid min="260px" gap={4}>
          {personas.map((persona) => (
            <Card key={persona.title} title={persona.title} description={persona.subtitle}>
              <div className={styles.body}>
                <p className={styles.pain}>
                  <span className={styles.label}>Challenge</span>
                  {persona.pain}
                </p>
                <p className={styles.solution}>
                  <span className={styles.label}>With cleanScheduler</span>
                  {persona.solution}
                </p>
              </div>
            </Card>
          ))}
        </Grid>
      </Container>
    </section>
  );
}
