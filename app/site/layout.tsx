import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function TenantSiteLayout({ children }: { children: ReactNode }) {
  return children;
}
