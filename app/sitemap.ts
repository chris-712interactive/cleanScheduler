import type { MetadataRoute } from 'next';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

const MARKETING_PATHS = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/start-trial', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/security', priority: 0.6, changeFrequency: 'monthly' as const },
  {
    path: '/security/information-security-policy',
    priority: 0.5,
    changeFrequency: 'yearly' as const,
  },
  {
    path: '/security/access-control-policy',
    priority: 0.5,
    changeFrequency: 'yearly' as const,
  },
  { path: '/privacy', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/terms', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/data-retention', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/sign-in', priority: 0.3, changeFrequency: 'yearly' as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicOrigin(null);
  const lastModified = new Date();

  return MARKETING_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${origin}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
