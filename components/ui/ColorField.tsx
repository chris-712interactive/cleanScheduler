'use client';

import { parseCssColorToHex } from '@/lib/ui/parseCssColor';
import styles from './ColorField.module.scss';

export function ColorField({
  id,
  name,
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const parsed = parseCssColorToHex(value);
  const pickerValue = (parsed ?? '#0D9488').toLowerCase();

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.row}>
        <input
          type="color"
          className={styles.picker}
          value={pickerValue}
          aria-label={`${label} picker`}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
        />
        <input
          id={id}
          name={name}
          type="text"
          className={styles.text}
          value={value}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="#0D9488 or rgb(13, 148, 136)"
          aria-invalid={value.trim().length > 0 && !parsed ? true : undefined}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
