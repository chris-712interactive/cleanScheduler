'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { clearPortalNavPending } from './portalNavPending';

/** Clears the nav-click fade once the URL commits. Use only in portal chrome, not route content. */
export function useClearPortalNavPendingOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    clearPortalNavPending();
  }, [pathname]);
}
