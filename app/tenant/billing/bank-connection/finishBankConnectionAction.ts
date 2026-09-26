'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export type BankConnectionActionResult = { ok: true } | { error: string };

export type BankConnectionSuccessParam =
  'connected' | 'synced' | 'matched' | 'dismissed' | 'disconnected';

export function bankConnectionResultHref(
  result: BankConnectionActionResult,
  successParam: BankConnectionSuccessParam,
): string {
  if ('error' in result) {
    return `/billing/bank-connection?error=${encodeURIComponent(result.error)}`;
  }
  return `/billing/bank-connection?${successParam}=1`;
}

export function useFinishBankConnectionAction() {
  const router = useRouter();
  return useCallback(
    (result: BankConnectionActionResult, successParam: BankConnectionSuccessParam) => {
      router.push(bankConnectionResultHref(result, successParam));
      router.refresh();
    },
    [router],
  );
}
