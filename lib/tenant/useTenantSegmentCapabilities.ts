'use client';

import { useMemo } from 'react';
import {
  capabilitiesForSegment,
  type SegmentCapabilities,
  type TenantServiceSegment,
} from '@/lib/tenant/serviceSegment';

/** Client view of {@link capabilitiesForSegment}. Pass the tenant setting; do not branch on the raw string in each screen. */
export function useTenantSegmentCapabilities(
  segment: TenantServiceSegment | null | undefined,
): SegmentCapabilities {
  return useMemo(() => capabilitiesForSegment(segment), [segment]);
}
