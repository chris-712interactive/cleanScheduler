'use client';

import Image from 'next/image';
import styles from './PersonAvatarChip.module.scss';

const SIZE_PX = { sm: 28, md: 36, lg: 48 } as const;

export type AvatarChipSize = keyof typeof SIZE_PX;

export function PersonAvatarChip({
  firstName,
  displayName,
  avatarUrl,
  initials,
  variant = 'crew',
  size = 'sm',
}: {
  firstName: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  variant?: 'crew' | 'customer';
  size?: AvatarChipSize;
}) {
  const px = SIZE_PX[size];
  const variantClass = variant === 'customer' ? styles.customer : styles.crew;
  const sizeClass =
    size === 'lg' ? styles.size_lg : size === 'md' ? styles.size_md : styles.size_sm;

  return (
    <span
      className={`${styles.chip} ${variantClass} ${sizeClass}`}
      title={firstName}
      aria-label={displayName}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" width={px} height={px} className={styles.img} />
      ) : (
        initials
      )}
    </span>
  );
}
