/**
 * EmptyState - the standard "no data yet" / "nothing matches" placeholder.
 * Pair with a `Button` action to make the next step obvious for the user.
 */
import type { ReactNode } from 'react';
import styles from './EmptyState.module.scss';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={[styles.emptyState, className].filter(Boolean).join(' ')}>
      {icon ? <div className={styles.icon}>{icon}</div> : null}
      <h3 className={styles.title}>{title}</h3>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
