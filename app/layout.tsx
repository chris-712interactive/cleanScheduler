import type { Metadata, Viewport } from 'next';
import 'modern-normalize';
import '@/styles/globals.scss';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { themeScript } from '@/components/theme/themeScript';

export const metadata: Metadata = {
  title: {
    default: 'cleanScheduler',
    template: '%s | cleanScheduler',
  },
  description:
    'Multi-tenant scheduling, quoting, billing, and customer-service platform for residential and commercial cleaning businesses.',
  applicationName: 'cleanScheduler',
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
