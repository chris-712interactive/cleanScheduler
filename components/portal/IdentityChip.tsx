'use client';

/**
 * IdentityChip - the avatar + name bundle in the top-right corner. Currently
 * a static display; once auth ships it will host the account dropdown menu
 * (sign out, switch tenant, account settings).
 */
import Image from 'next/image';
import type { IdentityChipModel } from './types';
import styles from './IdentityChip.module.scss';

export function IdentityChip({ name, subtitle, initials, avatarUrl }: IdentityChipModel) {
  const fallback = initials ?? name.slice(0, 2).toUpperCase();

  return (
    <div className={styles.chip} role="group" aria-label={`Account: ${name}`}>
      <span className={styles.avatar} aria-hidden="true">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={32} height={32} />
        ) : (
          <span className={styles.initials}>{fallback}</span>
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
    </div>
  );
}
