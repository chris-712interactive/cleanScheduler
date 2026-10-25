export type TenantSiteRobots = {
  rules: {
    userAgent: string;
    allow?: string | string[];
    disallow?: string | string[];
  };
  sitemap?: string;
};

/**
 * Robots policy for one tenant host.
 * Platform-hosted sites only expose `/site`. Unified custom domains expose `/`
 * and keep the customer portal out of the index.
 */
export function buildTenantSiteRobots(options: {
  indexable: boolean;
  unifiedDomain: boolean;
  sitemapUrl?: string | null;
}): TenantSiteRobots {
  if (!options.indexable) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  const robots: TenantSiteRobots = options.unifiedDomain
    ? {
        rules: {
          userAgent: '*',
          allow: '/',
          disallow: ['/portal', '/api/'],
        },
      }
    : {
        rules: {
          userAgent: '*',
          allow: '/site',
          disallow: '/',
        },
      };

  if (options.sitemapUrl) {
    robots.sitemap = options.sitemapUrl;
  }

  return robots;
}

export function formatRobotsTxt(robots: TenantSiteRobots): string {
  const { allow, disallow } = robots.rules;
  const lines = ['User-agent: *'];

  const allowPaths = allow == null ? [] : Array.isArray(allow) ? allow : [allow];
  const disallowPaths = disallow == null ? [] : Array.isArray(disallow) ? disallow : [disallow];

  for (const path of allowPaths) lines.push(`Allow: ${path}`);
  for (const path of disallowPaths) lines.push(`Disallow: ${path}`);
  if (robots.sitemap) lines.push(`Sitemap: ${robots.sitemap}`);
  lines.push('');
  return lines.join('\n');
}
