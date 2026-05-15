'use client';

import Image from 'next/image';
import styles from './PersonAvatarChip.module.scss';

export function PersonAvatarChip({
  firstName,
  displayName,
  avatarUrl,
  initials,
  variant = 'crew',
}: {
  firstName: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  variant?: 'crew' | 'customer';
}) {
  const variantClass = variant === 'customer' ? styles.customer : styles.crew;

  return (
    <span
      className={`${styles.chip} ${variantClass}`}
      title={firstName}
      aria-label={displayName}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" width={28} height={28} className={styles.img} />
      ) : (
        initials
      )}
    </span>
  );
}
