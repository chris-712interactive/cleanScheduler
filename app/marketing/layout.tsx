import type { ReactNode } from 'react';
import styles from './marketing.module.scss';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={styles.marketing}>{children}</div>;
}
