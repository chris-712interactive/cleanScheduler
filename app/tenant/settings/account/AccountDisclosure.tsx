'use client';

import { useState, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useTheme } from '@/components/theme/ThemeProvider';
import styles from '../../customers/scheduling-fields.module.scss';

export function AccountDisclosure({
  title,
  hint,
  children,
  id,
  startOpen = false,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  id?: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);

  return (
    <details
      id={id}
      className={styles.section}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.sectionSummary}>
        <span className={styles.sectionTitle}>{title}</span>
        {hint ? <span className={styles.sectionHint}>{hint}</span> : null}
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}

export function AccountAppearanceDisclosure() {
  const { preference } = useTheme();
  const hint =
    preference === 'dark' ? 'Dark' : preference === 'system' ? 'Match this device' : 'Light';

  return (
    <AccountDisclosure id="account-appearance" title="Appearance" hint={hint}>
      <p className={styles.note}>Light, dark, or match your device.</p>
      <ThemeToggle />
    </AccountDisclosure>
  );
}
