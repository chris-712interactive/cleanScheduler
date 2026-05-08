'use client';

/**
 * Three-state theme toggle: System / Light / Dark.
 *
 * Renders as an accessible segmented control. The pre-hydration script in
 * themeScript.ts has already set the correct theme by the time this is
 * mounted; this component just lets the user change it.
 */

import { Monitor, Moon, Sun } from 'lucide-react';
import { type ThemePreference } from './themeScript';
import { useTheme } from './ThemeProvider';
import styles from './ThemeToggle.module.scss';

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className={styles.group}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            className={styles.option}
            data-selected={selected || undefined}
            onClick={() => setPreference(value)}
          >
            <Icon size={16} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
