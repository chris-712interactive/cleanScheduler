import type { ReactNode } from 'react';
import styles from './dashboard.module.scss';

export interface DashboardStatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  badge: ReactNode;
  badgeTone?: 'brand' | 'muted' | 'warn';
  actionLabel: string;
  actionHref: string;
}

export function DashboardStatCard({
  icon,
  label,
  value,
  badge,
  badgeTone = 'brand',
  actionLabel,
  actionHref,
}: DashboardStatCardProps) {
  const badgeClass = [
    styles.statBadge,
    badgeTone === 'muted' ? styles.statBadgeMuted : '',
    badgeTone === 'warn' ? styles.statBadgeWarn : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={styles.statCard}>
      <span className={styles.statIconWrap} aria-hidden>
        {icon}
      </span>
      <h2 className={styles.statLabel}>{label}</h2>
      <p className={styles.statValue}>{value}</p>
      <p className={badgeClass}>
        <span className={styles.statBadgeDot} aria-hidden />
        {badge}
      </p>
      <a href={actionHref} className={styles.statAction}>
        {actionLabel}
      </a>
    </article>
  );
}
