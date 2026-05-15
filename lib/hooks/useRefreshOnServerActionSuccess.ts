'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * After a server action returns `{ success: true }`, refetch Server Components so
 * lists and counts update. Needed alongside `revalidatePath` when the tenant
 * portal is served via middleware URL rewrites (`/customers` → `/tenant/customers`).
 */
/** Accepts boolean or message string — any truthy value triggers a refresh. */
export function useRefreshOnServerActionSuccess(success: boolean | string | undefined) {
  const router = useRouter();
  const didRefresh = useRef(false);

  useEffect(() => {
    if (success) {
      if (!didRefresh.current) {
        didRefresh.current = true;
        router.refresh();
      }
    } else {
      didRefresh.current = false;
    }
  }, [success, router]);
}
