import { Container } from '@/components/layout/Container';
import styles from './SocialProof.module.scss';

export interface SocialProofProps {
  headline: string;
  highlights: string[];
}

export function SocialProof({ headline, highlights }: SocialProofProps) {
  return (
    <section className={styles.section} aria-label="Product highlights">
      <Container>
        <div className={styles.inner}>
          <p className={styles.headline}>{headline}</p>
          <ul className={styles.highlights}>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
