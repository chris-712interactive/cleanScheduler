import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './settings.module.scss';

export function SettingsSectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.sectionCard}>
      <header className={styles.sectionCardHeader}>
        <span className={styles.sectionCardIcon} aria-hidden>
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className={styles.sectionCardCopy}>
          <h2 className={styles.sectionCardTitle}>{title}</h2>
          <p className={styles.sectionCardDescription}>{description}</p>
        </div>
      </header>
      <div className={styles.sectionCardBody}>{children}</div>
    </article>
  );
}
