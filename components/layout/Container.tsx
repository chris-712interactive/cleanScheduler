/**
 * Container - horizontally-centered, max-width content wrapper. Sets
 * consistent inline padding and a sensible reading width across portals.
 */
import { forwardRef, type ElementType, type ReactNode } from 'react';
import styles from './Container.module.scss';

export interface ContainerProps {
  as?: ElementType;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  children?: ReactNode;
}

export const Container = forwardRef<HTMLElement, ContainerProps>(function Container(
  { as: Tag = 'div', size = 'lg', className, children, ...rest },
  ref,
) {
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={[styles.container, className].filter(Boolean).join(' ')}
      data-size={size}
      {...rest}
    >
      {children}
    </Tag>
  );
});
