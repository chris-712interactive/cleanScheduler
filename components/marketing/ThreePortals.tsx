import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { ProductScreenshot } from '@/components/marketing/ProductScreenshot';
import styles from './ThreePortals.module.scss';

type PortalItem = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  variant?: 'desktop' | 'mobile';
};

export interface ThreePortalsProps {
  portals: PortalItem[];
}

export function ThreePortals({ portals }: ThreePortalsProps) {
  return (
    <section className={styles.section}>
      <Container size="lg">
        <Stack gap={6}>
          <Stack gap={2} align="center" as="div">
            <h2 className={styles.title}>One platform, three portals</h2>
            <p className={styles.lead}>
              Your team, your customers, and your field crews each get a focused experience —
              connected to the same data.
            </p>
          </Stack>
          <div className={styles.grid}>
            {portals.map((portal) => (
              <article key={portal.title} className={styles.portal}>
                <ProductScreenshot
                  src={portal.imageSrc}
                  alt={portal.imageAlt}
                  variant={portal.variant ?? 'desktop'}
                />
                <div className={styles.copy}>
                  <h3 className={styles.portalTitle}>{portal.title}</h3>
                  <p className={styles.portalDescription}>{portal.description}</p>
                </div>
              </article>
            ))}
          </div>
        </Stack>
      </Container>
    </section>
  );
}

export type { PortalItem };
