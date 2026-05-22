import type { MetadataRoute } from 'next';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicOrigin(null);

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/tenant/', '/customer/'],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
