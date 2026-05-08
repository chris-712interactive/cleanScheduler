/**
 * Skeleton - shimmering placeholder for content that is loading. Honours
 * `prefers-reduced-motion` automatically (the shimmer animation duration is
 * collapsed by the reduced-motion override in styles/_theme.scss).
 */
import type { CSSProperties } from 'react';
import styles from './Skeleton.module.scss';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: 'sm' | 'md' | 'lg' | 'pill' | 'circle';
  className?: string;
  ariaLabel?: string;
}

function toLength(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return `${value}px`;
  return value;
}

export function Skeleton({
  width,
  height = 16,
  radius = 'sm',
  className,
  ariaLabel = 'Loading',
}: SkeletonProps) {
  const style: CSSProperties = {
    width: toLength(width),
    height: toLength(height),
  };

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      data-radius={radius}
      className={[styles.skeleton, className].filter(Boolean).join(' ')}
      style={style}
    />
  );
}
