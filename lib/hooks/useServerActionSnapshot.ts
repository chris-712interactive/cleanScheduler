'use client';

import { useEffect } from 'react';

/** Apply a snapshot/patch from a successful server action without router.refresh(). */
export function useServerActionSnapshot<T>(
  success: boolean | string | undefined,
  snapshot: T | undefined,
  onSnapshot: ((snapshot: T) => void) | undefined,
) {
  useEffect(() => {
    if (success && snapshot !== undefined && onSnapshot) {
      onSnapshot(snapshot);
    }
  }, [success, snapshot, onSnapshot]);
}
