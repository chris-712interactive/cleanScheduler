/**
 * Button - the canonical interactive primitive. Supports primary, secondary,
 * ghost, and danger variants plus a loading state.
 *
 * Polymorphic via `as` so the same visual shape can render as <button>,
 * <a>, or a Next.js <Link>. Always pass `aria-label` when the visible label
 * is icon-only.
 */
import { forwardRef, type ButtonHTMLAttributes, type ElementType, type ReactNode } from 'react';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  as?: ElementType;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    as: Tag = 'button',
    variant = 'primary',
    size = 'md',
    iconLeft,
    iconRight,
    fullWidth,
    loading,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      type={Tag === 'button' ? type : undefined}
      disabled={Tag === 'button' ? isDisabled : undefined}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-full-width={fullWidth || undefined}
      className={[styles.button, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {iconLeft ? <span className={styles.icon}>{iconLeft}</span> : null}
      <span className={styles.label}>{children}</span>
      {iconRight ? <span className={styles.icon}>{iconRight}</span> : null}
    </Tag>
  );
});
