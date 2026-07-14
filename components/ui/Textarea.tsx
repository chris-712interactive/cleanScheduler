/**
 * Textarea - canonical multi-line field primitive. Use with FormField for labels/errors.
 */
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.scss';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      data-invalid={invalid || undefined}
      aria-invalid={invalid || undefined}
      className={[styles.textarea, className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});
