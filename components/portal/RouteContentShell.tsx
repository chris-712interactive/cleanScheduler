import type { ReactNode } from 'react';
import styles from './RouteContentShell.module.scss';

export function RouteContentShell({ children }: { children: ReactNode }) {
  return <div className={styles.wrap}>{children}</div>;
}
