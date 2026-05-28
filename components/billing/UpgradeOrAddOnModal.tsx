'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import styles from './UpgradeOrAddOnModal.module.scss';

export function UpgradeOrAddOnModal({
  open,
  title,
  message,
  billingHref = '/billing',
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  billingHref?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="upgrade-modal-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Link href={billingHref} className={styles.upgradeLink}>
            <Button type="button" variant="primary">
              Upgrade plan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
