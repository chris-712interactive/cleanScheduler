/**
 * Input - canonical text field primitive. Use with FormField for labels/errors.
 */
import { forwardRef, type InputHTMLAttributes } from 'react';
import styles from './Input.module.scss';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      data-invalid={invalid || undefined}
      aria-invalid={invalid || undefined}
      className={[styles.input, className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});
