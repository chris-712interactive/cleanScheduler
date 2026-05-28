import Link from 'next/link';
import styles from './FeatureUpgradePanel.module.scss';

export function FeatureUpgradePanel({
  title,
  description,
  billingHref = '/billing',
}: {
  title: string;
  description: string;
  billingHref?: string;
}) {
  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.copy}>{description}</p>
      <Link href={billingHref} className={styles.link}>
        View workspace billing
      </Link>
    </div>
  );
}
