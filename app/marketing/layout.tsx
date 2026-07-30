import type { ReactNode } from 'react';
import { GoogleAnalytics } from '@/components/marketing/GoogleAnalytics';
import styles from './marketing.module.scss';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.marketing}>
      <GoogleAnalytics />
      {children}
    </div>
  );
}
