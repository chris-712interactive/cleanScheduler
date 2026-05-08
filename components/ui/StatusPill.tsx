/**
 * StatusPill - rounded badge representing state (active, pending, paid,
 * overdue, etc.). The visible label is mandatory; the pill never relies on
 * color alone to convey meaning.
 */
import type { ReactNode } from 'react';
import styles from './StatusPill.module.scss';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export interface StatusPillProps {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function StatusPill({ tone = 'neutral', icon, children, className }: StatusPillProps) {
  return (
    <span
      data-tone={tone}
      className={[styles.pill, className].filter(Boolean).join(' ')}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
    </span>
  );
}
