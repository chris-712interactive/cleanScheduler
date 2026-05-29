'use client';

import { useEffect } from 'react';
import type { CustomerPropertiesPatch } from '@/lib/tenant/customerPropertyPatch';

export function useServerActionPropertiesPatch(
  success: boolean | undefined,
  propertiesPatch: CustomerPropertiesPatch | undefined,
  onPropertiesPatch: ((patch: CustomerPropertiesPatch) => void) | undefined,
) {
  useEffect(() => {
    if (success && propertiesPatch && onPropertiesPatch) {
      onPropertiesPatch(propertiesPatch);
    }
  }, [success, propertiesPatch, onPropertiesPatch]);
}
