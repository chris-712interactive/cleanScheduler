import type { MetadataRoute } from 'next';
import { getAllPublicSeoPaths } from '@/lib/marketing/seoContent';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

const MARKETING_PATHS = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/start-trial', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/compare', priority: 0.75, changeFrequency: 'monthly' as const },
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
  { path: '/sms-terms', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/terms', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/data-retention', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/sign-in', priority: 0.3, changeFrequency: 'yearly' as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicOrigin(null);
  const lastModified = new Date();

  const seoPaths = getAllPublicSeoPaths();

  const helpPaths = [
    { path: '/help', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/help/customers', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/help/developers', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/help/compliance', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/help/faq', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/help/contact', priority: 0.4, changeFrequency: 'yearly' as const },
    { path: '/help/tcr', priority: 0.3, changeFrequency: 'monthly' as const },
  ];

  const allPaths = [...MARKETING_PATHS, ...seoPaths, ...helpPaths];
  const seen = new Set<string>();

  return allPaths
    .filter(({ path }) => {
      if (seen.has(path)) return false;
      seen.add(path);
      return true;
    })
    .map(({ path, priority, changeFrequency }) => ({
      url: `${origin}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }));
}
