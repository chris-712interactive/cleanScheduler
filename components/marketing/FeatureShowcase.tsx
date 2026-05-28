import { Check } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { ProductScreenshot } from '@/components/marketing/ProductScreenshot';
import type { MarketingFeatureShowcase } from '@/lib/marketing/homepageContent';
import styles from './FeatureShowcase.module.scss';

export interface FeatureShowcaseProps {
  feature: MarketingFeatureShowcase;
  reverse?: boolean;
  surface?: boolean;
}

export function FeatureShowcase({
  feature,
  reverse = false,
  surface = false,
}: FeatureShowcaseProps) {
  return (
    <section
      className={styles.section}
      id={feature.id}
      data-reverse={reverse || undefined}
      data-surface={surface || undefined}
    >
      <Container size="lg">
        <div className={styles.grid}>
          <div className={styles.copy}>
            <span className={styles.eyebrow}>{feature.eyebrow}</span>
            <h2 className={styles.title}>{feature.title}</h2>
            <p className={styles.description}>{feature.description}</p>
            <ul className={styles.bullets}>
              {feature.bullets.map((bullet) => (
                <li key={bullet}>
                  <Check size={18} aria-hidden className={styles.checkIcon} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            {feature.tierBadge ? (
              <p className={styles.tierBadge}>{feature.tierBadge.label}</p>
            ) : null}
          </div>
          <ProductScreenshot src={feature.imageSrc} alt={feature.imageAlt} />
        </div>
      </Container>
    </section>
  );
}
