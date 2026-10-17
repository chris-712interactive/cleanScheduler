'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import styles from '../billing.module.scss';

export interface BankConnectionFlash {
  error?: string;
  connected?: boolean;
  synced?: boolean;
  matched?: boolean;
  dismissed?: boolean;
  disconnected?: boolean;
  imported?: number;
  skipped?: number;
}

const FLASH_QUERY_KEYS = [
  'error',
  'connected',
  'synced',
  'matched',
  'dismissed',
  'disconnected',
  'imported',
  'skipped',
] as const;

function hasFlash(flash: BankConnectionFlash): boolean {
  return Boolean(
    flash.error ||
    flash.connected ||
    flash.synced ||
    flash.matched ||
    flash.dismissed ||
    flash.disconnected ||
    (flash.imported ?? 0) > 0,
  );
}

interface BankConnectionFlashBannersProps {
  flash: BankConnectionFlash;
  mfaBlocksPlaid: boolean;
  mfaEnrolled: boolean;
}

export function BankConnectionFlashBanners({
  flash,
  mfaBlocksPlaid,
  mfaEnrolled,
}: BankConnectionFlashBannersProps) {
  const pathname = usePathname();
  const [visibleFlash] = useState(flash);

  useEffect(() => {
    if (!hasFlash(flash)) return;

    const url = new URL(window.location.href);
    let changed = false;
    for (const key of FLASH_QUERY_KEYS) {
      if (!url.searchParams.has(key)) continue;
      url.searchParams.delete(key);
      changed = true;
    }
    if (!changed) return;

    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', next);
  }, [flash, pathname]);

  const imported = visibleFlash.imported ?? 0;
  const skipped = visibleFlash.skipped ?? 0;
  useFeedbackToast([
    { error: visibleFlash.error },
    {
      success: visibleFlash.connected
        ? 'Bank account connected. Initial transaction sync started.'
        : null,
    },
    { success: visibleFlash.synced ? 'Bank transactions refreshed.' : null },
    {
      success: visibleFlash.matched ? 'Deposit matched and invoice payment recorded.' : null,
    },
    { success: visibleFlash.dismissed ? 'Match suggestion dismissed.' : null },
    { success: visibleFlash.disconnected ? 'Bank connection removed.' : null },
    {
      success:
        imported > 0
          ? `Imported ${imported} bank deposit row${imported === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} duplicate or invalid rows skipped)` : ''}. Match suggestions were refreshed.`
          : null,
    },
  ]);

  if (!mfaBlocksPlaid) return null;

  return (
    <p className={styles.bannerError} role="alert">
      Two-factor authentication is required before connecting a bank account.{' '}
      <Link href="/settings/account">Enable MFA in Account settings</Link>
      {mfaEnrolled ? (
        <>
          {' '}
          or <Link href="/sign-in/mfa?next=/billing/bank-connection">verify your session</Link>.
        </>
      ) : null}
    </p>
  );
}
