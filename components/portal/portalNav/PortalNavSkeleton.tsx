import { Skeleton } from '@/components/ui/Skeleton';
import styles from './PortalNavSkeleton.module.scss';

export function PortalNavSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <nav aria-busy="true" aria-label="Loading navigation">
      <ul className={styles.list}>
        {Array.from({ length: rows }).map((_, index) => (
          <li key={index}>
            <Skeleton width="100%" height={36} radius="md" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
