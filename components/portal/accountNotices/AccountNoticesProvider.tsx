'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AccountNotice } from '@/lib/billing/accountNotices';

interface AccountNoticesContextValue {
  notices: AccountNotice[];
  register: (notice: AccountNotice) => () => void;
}

const EMPTY_NOTICES: AccountNotice[] = [];

const AccountNoticesContext = createContext<AccountNoticesContextValue | null>(null);

function sameNotice(a: AccountNotice, b: AccountNotice): boolean {
  return (
    a.tone === b.tone &&
    a.priority === b.priority &&
    a.label === b.label &&
    a.detail === b.detail &&
    a.href === b.href &&
    a.actionLabel === b.actionLabel
  );
}

export function AccountNoticesProvider({
  headerNotices = EMPTY_NOTICES,
  children,
}: {
  /** Notices known while rendering the shell, so the chip is in the first paint. */
  headerNotices?: AccountNotice[];
  children: ReactNode;
}) {
  const [registered, setRegistered] = useState<ReadonlyMap<string, AccountNotice>>(() => new Map());

  const register = useCallback((notice: AccountNotice) => {
    setRegistered((prev) => {
      const existing = prev.get(notice.id);
      if (existing && sameNotice(existing, notice)) return prev;
      const next = new Map(prev);
      next.set(notice.id, notice);
      return next;
    });

    return () => {
      setRegistered((prev) => {
        if (!prev.has(notice.id)) return prev;
        const next = new Map(prev);
        next.delete(notice.id);
        return next;
      });
    };
  }, []);

  const notices = useMemo(() => {
    const merged = new Map<string, AccountNotice>();
    for (const notice of headerNotices) merged.set(notice.id, notice);
    for (const notice of registered.values()) merged.set(notice.id, notice);
    return [...merged.values()].sort(
      (a, b) => b.priority - a.priority || a.label.localeCompare(b.label),
    );
  }, [headerNotices, registered]);

  const value = useMemo(() => ({ notices, register }), [notices, register]);

  return <AccountNoticesContext.Provider value={value}>{children}</AccountNoticesContext.Provider>;
}

export function useAccountNotices(): AccountNoticesContextValue {
  const value = useContext(AccountNoticesContext);
  if (value) return value;
  return {
    notices: [],
    register: () => () => {},
  };
}
