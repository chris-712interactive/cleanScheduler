/**
 * Select - canonical native select primitive. Prefer SearchableSelect for long lists.
 */
import { forwardRef, type SelectHTMLAttributes } from 'react';
import styles from './Select.module.scss';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      data-invalid={invalid || undefined}
      aria-invalid={invalid || undefined}
      className={[styles.select, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </select>
  );
});
