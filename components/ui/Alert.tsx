/**
 * Alert - inline status banner for form/page feedback (errors, success, info).
 */
import type { ReactNode } from 'react';
import styles from './Alert.module.scss';

export type AlertVariant = 'danger' | 'success' | 'warning' | 'info';

export interface AlertProps {
  children: ReactNode;
  title?: ReactNode;
  variant?: AlertVariant;
  className?: string;
}

export function Alert({ children, title, variant = 'danger', className }: AlertProps) {
  return (
    <div
      role="alert"
      data-variant={variant}
      className={[styles.alert, className].filter(Boolean).join(' ')}
    >
      {title ? <p className={styles.title}>{title}</p> : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
