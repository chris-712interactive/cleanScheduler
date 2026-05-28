import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { Skeleton } from '@/components/ui/Skeleton';
import styles from './PortalRouteLoading.module.scss';

export function PortalRouteLoading({ variant = 'default' }: { variant?: 'default' | 'table' | 'board' }) {
  if (variant === 'board') {
    return (
      <Container size="full" className={styles.wrap} aria-busy="true" aria-label="Loading">
        <Stack gap={4}>
          <Skeleton width="40%" height={28} radius="md" />
          <div className={styles.boardRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.boardCol}>
                <Skeleton width="70%" height={18} />
                <Skeleton width="100%" height={88} radius="md" />
                <Skeleton width="100%" height={88} radius="md" />
              </div>
            ))}
          </div>
        </Stack>
      </Container>
    );
  }

  if (variant === 'table') {
    return (
      <Container size="lg" className={styles.wrap} aria-busy="true" aria-label="Loading">
        <Stack gap={4}>
          <Skeleton width="35%" height={28} radius="md" />
          <Skeleton width="100%" height={40} radius="md" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={52} radius="md" />
          ))}
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg" className={styles.wrap} aria-busy="true" aria-label="Loading">
      <Stack gap={4}>
        <Skeleton width="45%" height={32} radius="md" />
        <Skeleton width="100%" height={120} radius="md" />
        <Skeleton width="100%" height={200} radius="md" />
      </Stack>
    </Container>
  );
}
