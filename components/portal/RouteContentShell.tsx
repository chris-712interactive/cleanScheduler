'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import styles from './RouteContentShell.module.scss';

export function RouteContentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={styles.wrap}>
      {children}
    </div>
  );
}
