/**
 * Card - elevated surface for grouping related content. Provides optional
 * header / footer slots and a `padded` flag for callers that need to render
 * tables or maps edge-to-edge.
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import styles from './Card.module.scss';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, description, actions, footer, padded = true, className, children, ...rest },
  ref,
) {
  const hasHeader = title || description || actions;

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      className={[styles.card, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {hasHeader ? (
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            {title ? <h2 className={styles.title}>{title}</h2> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={styles.body} data-padded={padded || undefined}>
        {children}
      </div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </section>
  );
});
