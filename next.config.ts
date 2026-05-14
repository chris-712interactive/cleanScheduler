import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  sassOptions: {
    includePaths: [path.join(process.cwd(), 'styles')],
    silenceDeprecations: ['legacy-js-api'],
  },
  // typedRoutes is intentionally disabled during the scaffold phase. We'll
  // re-enable once the route tree is stable so we don't have to cast every
  // forward-looking <Link href> through `as never`.
  // experimental: { typedRoutes: true },
};

export default config;
