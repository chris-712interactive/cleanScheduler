'use client';

import { useEffect } from 'react';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';

/** Apply a visit patch from a successful server action without router.refresh(). */
export function useServerActionVisitPatch(
  success: boolean | string | undefined,
  visitPatch: VisitDetailPatch | undefined,
  onVisitPatch: ((patch: VisitDetailPatch) => void) | undefined,
) {
  useEffect(() => {
    if (success && visitPatch && onVisitPatch) {
      onVisitPatch(visitPatch);
    }
  }, [success, visitPatch, onVisitPatch]);
}
