/**
 * Stack - vertical layout primitive. Uses CSS gap (no margin collapse) so
 * spacing is predictable regardless of children.
 */
import { forwardRef, type ElementType, type ReactNode } from 'react';
import styles from './Stack.module.scss';

export type StackGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface StackProps {
  as?: ElementType;
  gap?: StackGap;
  align?: 'start' | 'center' | 'end' | 'stretch';
  className?: string;
  children?: ReactNode;
}

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { as: Tag = 'div', gap = 4, align = 'stretch', className, children, ...rest },
  ref,
) {
  // Casting the ref to `any` (one place) is the standard escape hatch for
  // polymorphic primitives; the public API is fully typed via `as`.
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={[styles.stack, className].filter(Boolean).join(' ')}
      data-gap={gap}
      data-align={align}
      {...rest}
    >
      {children}
    </Tag>
  );
});
