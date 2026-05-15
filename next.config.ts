import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Avatar uploads: originals may be large; Sharp compresses to ≤2MB before Storage.
  // Multipart bodies are larger than raw file bytes — leave headroom.
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
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
