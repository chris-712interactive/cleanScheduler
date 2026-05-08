/**
 * PageHeader - the standard "title + supporting copy + primary action" block
 * that opens every page. Required across all portals so the chrome reads
 * consistently regardless of which feature you're inside.
 */
import type { ReactNode } from 'react';
import styles from './PageHeader.module.scss';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <header className={[styles.header, className].filter(Boolean).join(' ')}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
          <ol className={styles.breadcrumbList}>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={idx} className={styles.breadcrumbItem}>
                  {crumb.href && !isLast ? (
                    <a href={crumb.href}>{crumb.label}</a>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className={styles.row}>
        <div className={styles.copy}>
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
