'use client';

import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth/signOutAction';
import styles from './SignOutButton.module.scss';

export function SignOutButton({
  variant = 'menu',
}: {
  /** `menu` for dropdown rows; `settings` for settings page card actions. */
  variant?: 'menu' | 'settings';
}) {
  if (variant === 'settings') {
    return (
      <form action={signOut} className={styles.settingsForm}>
        <button type="submit" className={styles.settingsButton}>
          <LogOut size={16} aria-hidden />
          Sign out
        </button>
      </form>
    );
  }

  return (
    <form action={signOut} className={styles.menuForm}>
      <button type="submit" className={styles.menuItem}>
        <LogOut size={16} aria-hidden />
        Sign out
      </button>
    </form>
  );
}
