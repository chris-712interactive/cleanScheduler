/**
 * Grid - responsive auto-fit grid with token-driven gutters.
 *
 *   <Grid min="240px" gap={4}>...</Grid>
 *
 * Uses CSS `repeat(auto-fit, minmax(...))` so consumers don't need to thread
 * media-query column counts through their pages for the common case.
 */
import { forwardRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import styles from './Grid.module.scss';

export interface GridProps {
  as?: ElementType;
  min?: string;
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  className?: string;
  children?: ReactNode;
}

export const Grid = forwardRef<HTMLElement, GridProps>(function Grid(
  { as: Tag = 'div', min = '240px', gap = 4, className, children, style, ...rest }: GridProps & {
    style?: CSSProperties;
  },
  ref,
) {
  const mergedStyle: CSSProperties = {
    ...style,
    ['--grid-min' as string]: min,
  };

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={[styles.grid, className].filter(Boolean).join(' ')}
      data-gap={gap}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
});
