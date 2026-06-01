'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
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

  const messages: ReactNode[] = [];

  if (visibleFlash.error) {
    messages.push(
      <p key="error" className={styles.bannerError} role="alert">
        {visibleFlash.error}
      </p>,
    );
  }

  if (mfaBlocksPlaid) {
    messages.push(
      <p key="mfa" className={styles.bannerError} role="alert">
        Two-factor authentication is required before connecting a bank account.{' '}
        <Link href="/settings/account">Enable MFA in Account settings</Link>
        {mfaEnrolled ? (
          <>
            {' '}
            or <Link href="/sign-in/mfa?next=/billing/bank-connection">verify your session</Link>.
          </>
        ) : null}
      </p>,
    );
  }

  if (visibleFlash.connected) {
    messages.push(
      <p key="connected" className={styles.bannerOk} role="status">
        Bank account connected. Initial transaction sync started.
      </p>,
    );
  }

  if (visibleFlash.synced) {
    messages.push(
      <p key="synced" className={styles.bannerOk} role="status">
        Bank transactions refreshed.
      </p>,
    );
  }

  if (visibleFlash.matched) {
    messages.push(
      <p key="matched" className={styles.bannerOk} role="status">
        Deposit matched and invoice payment recorded.
      </p>,
    );
  }

  if (visibleFlash.dismissed) {
    messages.push(
      <p key="dismissed" className={styles.bannerOk} role="status">
        Match suggestion dismissed.
      </p>,
    );
  }

  if (visibleFlash.disconnected) {
    messages.push(
      <p key="disconnected" className={styles.bannerOk} role="status">
        Bank connection removed.
      </p>,
    );
  }

  if ((visibleFlash.imported ?? 0) > 0) {
    const imported = visibleFlash.imported ?? 0;
    const skipped = visibleFlash.skipped ?? 0;
    messages.push(
      <p key="imported" className={styles.bannerOk} role="status">
        Imported {imported} bank deposit row{imported === 1 ? '' : 's'}
        {skipped > 0 ? ` (${skipped} duplicate or invalid rows skipped)` : ''}. Match suggestions
        were refreshed.
      </p>,
    );
  }

  if (messages.length === 0) return null;

  return <>{messages}</>;
}
