import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import styles from './SocialProof.module.scss';

export interface SocialProofItem {
  label: string;
  detail: string;
  href?: string;
}

export interface SocialProofProps {
  headline: string;
  highlights: string[];
  trustItems?: SocialProofItem[];
}

export function SocialProof({ headline, highlights, trustItems }: SocialProofProps) {
  return (
    <section className={styles.section} aria-label="Why cleaning businesses choose Clean Scheduler">
      <Container>
        <div className={styles.inner}>
          <p className={styles.headline}>{headline}</p>
          <ul className={styles.highlights}>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {trustItems && trustItems.length > 0 ? (
            <ul className={styles.trustList}>
              {trustItems.map((item) => (
                <li key={item.label} className={styles.trustItem}>
                  {item.href ? (
                    <Link href={item.href} className={styles.trustLink}>
                      <span className={styles.trustLabel}>{item.label}</span>
                      <span className={styles.trustDetail}>{item.detail}</span>
                    </Link>
                  ) : (
                    <>
                      <span className={styles.trustLabel}>{item.label}</span>
                      <span className={styles.trustDetail}>{item.detail}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
