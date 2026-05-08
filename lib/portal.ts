/**
 * Server-side helper for reading portal classification set by middleware.
 *
 * Server Components and Route Handlers should call `getPortalContext()` to
 * find out which portal (marketing / admin / customer / tenant) the current
 * request is hitting, plus the resolved tenant slug when applicable.
 */
import { headers } from 'next/headers';
import type { PortalKind } from '@/middleware';

export interface PortalContext {
  kind: PortalKind;
  tenantSlug: string | null;
}

export async function getPortalContext(): Promise<PortalContext> {
  const h = await headers();
  const kindHeader = h.get('x-portal');
  const kind: PortalKind =
    kindHeader === 'admin' || kindHeader === 'customer' || kindHeader === 'tenant'
      ? kindHeader
      : 'marketing';

  return {
    kind,
    tenantSlug: h.get('x-tenant-slug'),
  };
}
