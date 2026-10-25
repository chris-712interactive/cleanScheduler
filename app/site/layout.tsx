import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    template: '%s',
    default: 'Cleaning services',
  },
  openGraph: {
    images: [],
  },
  twitter: {
    images: [],
  },
};

export default function TenantSiteLayout({ children }: { children: ReactNode }) {
  return <div className="tenant-site-canvas">{children}</div>;
}
