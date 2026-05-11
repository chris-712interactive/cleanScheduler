'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * After a server action returns `{ success: true }`, refetch Server Components so
 * lists and counts update. Needed alongside `revalidatePath` when the tenant
 * portal is served via middleware URL rewrites (`/customers` → `/tenant/customers`).
 */
export function useRefreshOnServerActionSuccess(success: boolean | undefined) {
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
