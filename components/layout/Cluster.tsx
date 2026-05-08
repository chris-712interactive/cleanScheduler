/**
 * Cluster - horizontal flow that wraps. Useful for groups of buttons, filter
 * chips, badges, etc.
 */
import { forwardRef, type ElementType, type ReactNode } from 'react';
import styles from './Cluster.module.scss';

export interface ClusterProps {
  as?: ElementType;
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  align?: 'start' | 'center' | 'end' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
  className?: string;
  children?: ReactNode;
}

export const Cluster = forwardRef<HTMLElement, ClusterProps>(function Cluster(
  {
    as: Tag = 'div',
    gap = 2,
    align = 'center',
    justify = 'start',
    wrap = true,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={[styles.cluster, className].filter(Boolean).join(' ')}
      data-gap={gap}
      data-align={align}
      data-justify={justify}
      data-wrap={wrap || undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
});
