import Link from 'next/link';
import type { UtilizationAlert } from '@/lib/billing/usageUtilization';
import { utilizationBannerMessage } from '@/lib/billing/usageUtilization';
import styles from './UsageUtilizationBanner.module.scss';

export function UsageUtilizationBanner({ alert }: { alert: UtilizationAlert }) {
  const urgent = alert.level === 'critical' || alert.level === 'exceeded';

  return (
    <p
      className={styles.banner}
      data-urgency={urgent ? 'high' : undefined}
      role="status"
    >
      <span>{utilizationBannerMessage(alert)}</span>
      <Link href="/billing" className={styles.link}>
        View billing →
      </Link>
    </p>
  );
}
