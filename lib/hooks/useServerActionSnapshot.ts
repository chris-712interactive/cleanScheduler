'use client';

import { useEffect, useRef } from 'react';

/** Apply a snapshot/patch from a successful server action without router.refresh(). */
export function useServerActionSnapshot<T>(
  success: boolean | string | undefined,
  snapshot: T | undefined,
  onSnapshot: ((snapshot: T) => void) | undefined,
) {
  const lastAppliedRef = useRef<unknown>(undefined);

  useEffect(() => {
    if (!success || snapshot === undefined || !onSnapshot) {
      if (!success) lastAppliedRef.current = undefined;
      return;
    }

    if (lastAppliedRef.current === snapshot) return;
    lastAppliedRef.current = snapshot;
    onSnapshot(snapshot);
  }, [success, snapshot, onSnapshot]);
}
