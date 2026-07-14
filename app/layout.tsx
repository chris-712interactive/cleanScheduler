import type { Metadata, Viewport } from 'next';
import 'modern-normalize';
import '@/styles/globals.scss';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { themeScript } from '@/components/theme/themeScript';
import { ToastProvider } from '@/components/ui/Toast';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/marketingPageMetadata';
import { PRODUCT_NAME } from '@/lib/legal/site';

export const metadata: Metadata = {
  metadataBase: new URL(getPublicOrigin(null)),
  title: {
    default: PRODUCT_NAME,
    template: `%s | ${PRODUCT_NAME}`,
  },
  description:
    'Multi-tenant scheduling, quoting, billing, and customer-service platform for residential and commercial cleaning businesses.',
  applicationName: PRODUCT_NAME,
  openGraph: {
    siteName: PRODUCT_NAME,
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    images: [DEFAULT_OG_IMAGE.url],
  },
  manifest: '/favicon/manifest.json',
  icons: {
    icon: [
      { url: '/favicon/icon0.svg', type: 'image/svg+xml' },
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/icon1.png', type: 'image/png', sizes: '96x96' },
      { url: '/favicon/web-app-manifest-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon/web-app-manifest-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/favicon/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1F1F' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme script - sets data-theme on <html> before
            React mounts so we never paint the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
