import Script from 'next/script';
import { isProd } from '@/lib/env';

/** Google Analytics 4 measurement ID for the public marketing site. */
export const GA_MEASUREMENT_ID = 'G-70BLY5W13P';

/**
 * Loads gtag.js on the marketing site in production only.
 * Local/dev traffic is excluded so it does not pollute GA reports.
 */
export function GoogleAnalytics() {
  if (!isProd()) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
