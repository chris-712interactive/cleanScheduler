'use client';

import { useEffect } from 'react';
import type { AccountNotice } from '@/lib/billing/accountNotices';
import { useAccountNotices } from './AccountNoticesProvider';

/** Publishes a notice into the header chip. Renders nothing. */
export function RegisterAccountNotice({ notice }: { notice: AccountNotice }) {
  const { register } = useAccountNotices();
  const { id, tone, priority, label, detail, href, actionLabel } = notice;

  useEffect(() => {
    return register({ id, tone, priority, label, detail, href, actionLabel });
  }, [register, id, tone, priority, label, detail, href, actionLabel]);

  return null;
}
