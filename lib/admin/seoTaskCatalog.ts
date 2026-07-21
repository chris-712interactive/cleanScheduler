export type SeoTaskCadence = 'once' | 'weekly' | 'monthly' | 'quarterly';

export type SeoTaskCategoryId =
  'near-win-pages' | 'post-deploy' | 'gsc-indexing' | 'ongoing-monitoring' | 'content-publishing';

export type SeoTaskDefinition = {
  id: string;
  category: SeoTaskCategoryId;
  title: string;
  detail: string;
  /** Public marketing path (e.g. /features/stripe-integration) or external URL. */
  href?: string;
  external?: boolean;
  cadence: SeoTaskCadence;
  sortOrder: number;
};

export const SEO_TASK_CATEGORIES: Array<{
  id: SeoTaskCategoryId;
  label: string;
  description: string;
}> = [
  {
    id: 'near-win-pages',
    label: 'Near-page-one pages',
    description:
      'Priority URLs from the GSC query report — confirm live copy and internal links after deploy.',
  },
  {
    id: 'post-deploy',
    label: 'Post-deploy validation',
    description: 'One-time technical checks after shipping SEO or marketing changes.',
  },
  {
    id: 'gsc-indexing',
    label: 'Search Console indexing',
    description: 'Request indexing for priority URLs in Google Search Console.',
  },
  {
    id: 'ongoing-monitoring',
    label: 'Ongoing monitoring',
    description: 'Recurring reminders to stay on top of rankings, coverage, and schema health.',
  },
  {
    id: 'content-publishing',
    label: 'When publishing SEO content',
    description: 'Run this checklist whenever you add or materially update a public SEO page.',
  },
];

const GSC_URL = 'https://search.google.com/search-console';
const RICH_RESULTS_URL = 'https://search.google.com/test/rich-results';

/** Versioned catalog — ids must stay stable once shipped (DB rows reference task_id). */
export const SEO_TASK_CATALOG: SeoTaskDefinition[] = [
  // Near-page-one pages (one-time verification after copy ship)
  {
    id: 'near-win-stripe',
    category: 'near-win-pages',
    title: 'Verify Stripe integration page is live',
    detail:
      'Confirm title, meta description, payment-processing section, and Stripe FAQs render on the public page. Target query: “cleaning company software with stripe integration”.',
    href: '/features/stripe-integration',
    cadence: 'once',
    sortOrder: 10,
  },
  {
    id: 'near-win-launch27',
    category: 'near-win-pages',
    title: 'Verify Launch27 alternative compare page',
    detail:
      'Confirm “Launch27 alternative” appears in title, headline, and FAQ. Target query: “launch27 alternative”.',
    href: '/compare/vs-launch27',
    cadence: 'once',
    sortOrder: 11,
  },
  {
    id: 'near-win-spreadsheet',
    category: 'near-win-pages',
    title: 'Verify spreadsheet replacement compare page',
    detail:
      'Confirm migration checklist, “replace cleaning spreadsheet software” FAQ, and links to scheduling + Stripe pages.',
    href: '/compare/spreadsheets-and-texts',
    cadence: 'once',
    sortOrder: 12,
  },
  {
    id: 'near-win-commercial-accounts',
    category: 'near-win-pages',
    title: 'Verify commercial accounts help guide',
    detail:
      'Confirm prospecting steps, commercial-accounts FAQ, and cross-links from /for/commercial-cleaning-companies.',
    href: '/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts',
    cadence: 'once',
    sortOrder: 13,
  },
  {
    id: 'near-win-janitorial',
    category: 'near-win-pages',
    title: 'Verify janitorial scheduling & timekeeping page',
    detail:
      'Confirm employee-scheduling FAQ and links to dispatch + crew-management guides. Target query: “janitorial scheduling and timekeeping”.',
    href: '/features/crew-scheduling-and-timekeeping',
    cadence: 'once',
    sortOrder: 14,
  },
  {
    id: 'near-win-payments',
    category: 'near-win-pages',
    title: 'Verify online payments feature page',
    detail:
      'Confirm credit-card processing section, invoice-software FAQ, and Stripe cross-links. Target query: “online payments for cleaning companies”.',
    href: '/features/invoicing-and-payments',
    cadence: 'once',
    sortOrder: 15,
  },
  {
    id: 'near-win-dispatch',
    category: 'near-win-pages',
    title: 'Verify dispatch software help article',
    detail:
      'Confirm title uses “dispatch software for cleaning companies” and links from the scheduling feature page.',
    href: '/help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners',
    cadence: 'once',
    sortOrder: 16,
  },
  {
    id: 'near-win-mobile',
    category: 'near-win-pages',
    title: 'Verify mobile app for cleaning employees page',
    detail:
      'Confirm mobile-employee phrasing in title, lead, and FAQ. Target queries: “mobile app for cleaning employees”, “cleaning crew mobile software”.',
    href: '/features/mobile-scheduling-for-cleaners',
    cadence: 'once',
    sortOrder: 17,
  },

  // Post-deploy validation
  {
    id: 'post-deploy-rich-results-home',
    category: 'post-deploy',
    title: 'Rich Results Test — homepage',
    detail:
      'Run Google Rich Results Test on /. Confirm Organization, WebSite, SoftwareApplication, and FAQ schema validate.',
    href: RICH_RESULTS_URL,
    external: true,
    cadence: 'once',
    sortOrder: 20,
  },
  {
    id: 'post-deploy-rich-results-pricing',
    category: 'post-deploy',
    title: 'Rich Results Test — pricing',
    detail: 'Validate tiered SoftwareApplication offers on /pricing.',
    href: RICH_RESULTS_URL,
    external: true,
    cadence: 'once',
    sortOrder: 21,
  },
  {
    id: 'post-deploy-rich-results-compare',
    category: 'post-deploy',
    title: 'Rich Results Test — Launch27 compare',
    detail:
      'Validate WebPage + Article + competitor SoftwareApplication entities on /compare/vs-launch27.',
    href: RICH_RESULTS_URL,
    external: true,
    cadence: 'once',
    sortOrder: 22,
  },
  {
    id: 'post-deploy-rich-results-feature',
    category: 'post-deploy',
    title: 'Rich Results Test — Stripe feature page',
    detail: 'Validate structured data on /features/stripe-integration.',
    href: RICH_RESULTS_URL,
    external: true,
    cadence: 'once',
    sortOrder: 23,
  },
  {
    id: 'post-deploy-rich-results-help',
    category: 'post-deploy',
    title: 'Rich Results Test — commercial accounts guide',
    detail: 'Validate Article + breadcrumb schema on the commercial accounts help article.',
    href: RICH_RESULTS_URL,
    external: true,
    cadence: 'once',
    sortOrder: 24,
  },
  {
    id: 'post-deploy-www-redirect',
    category: 'post-deploy',
    title: 'Confirm www → apex redirect',
    detail:
      'curl -sI https://www.cleanscheduler.com/ should return 308 to https://cleanscheduler.com/. Re-check after DNS or Vercel changes.',
    cadence: 'once',
    sortOrder: 25,
  },
  {
    id: 'post-deploy-canonical-tags',
    category: 'post-deploy',
    title: 'Spot-check canonical tags on live HTML',
    detail:
      'View source on homepage, one feature page, and one help article. Each should have rel=canonical pointing to the apex path. Also confirm /marketing/help/... 308s to /help/... (internal prefix must not be crawlable).',
    cadence: 'once',
    sortOrder: 26,
  },

  // GSC indexing
  {
    id: 'gsc-indexing-features-hub',
    category: 'gsc-indexing',
    title: 'Request indexing — features hub + near-win feature pages',
    detail:
      'In GSC URL Inspection, request indexing for /features, /features/stripe-integration, /features/scheduling-and-dispatch, /features/crew-scheduling-and-timekeeping, /features/mobile-scheduling-for-cleaners, and /features/invoicing-and-payments.',
    href: GSC_URL,
    external: true,
    cadence: 'once',
    sortOrder: 30,
  },
  {
    id: 'gsc-indexing-audience-pages',
    category: 'gsc-indexing',
    title: 'Request indexing — audience pages',
    detail:
      'Request indexing for /for/commercial-cleaning-companies and /for/residential-cleaning-companies.',
    href: GSC_URL,
    external: true,
    cadence: 'once',
    sortOrder: 31,
  },
  {
    id: 'gsc-indexing-compare-pages',
    category: 'gsc-indexing',
    title: 'Request indexing — compare pages',
    detail: 'Request indexing for /compare/spreadsheets-and-texts and /compare/vs-launch27.',
    href: GSC_URL,
    external: true,
    cadence: 'once',
    sortOrder: 32,
  },
  {
    id: 'gsc-indexing-help-guides',
    category: 'gsc-indexing',
    title: 'Request indexing — priority help guides',
    detail:
      'Request indexing for /help/cleaning-businesses/how-to-get-commercial-cleaning-accounts, /help/cleaning-businesses/schedule-cleaning-crews, and /help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners.',
    href: GSC_URL,
    external: true,
    cadence: 'once',
    sortOrder: 33,
  },

  // Ongoing monitoring
  {
    id: 'monitor-gsc-query-export',
    category: 'ongoing-monitoring',
    title: 'Export GSC query report and compare to baseline',
    detail:
      'Export the Queries report (28-day window). Compare positions for near-win terms: Stripe integration, Launch27 alternative, spreadsheet replacement, commercial accounts, janitorial scheduling, online payments. Baseline: ~178 impressions, 0 clicks, July 2026.',
    href: GSC_URL,
    external: true,
    cadence: 'monthly',
    sortOrder: 50,
  },
  {
    id: 'monitor-gsc-coverage',
    category: 'ongoing-monitoring',
    title: 'Review GSC Coverage for errors',
    detail:
      'Check Pages → Indexing for new crawl errors, soft 404s, or “Crawled – currently not indexed” spikes on marketing URLs.',
    href: GSC_URL,
    external: true,
    cadence: 'monthly',
    sortOrder: 51,
  },
  {
    id: 'monitor-gsc-top-queries',
    category: 'ongoing-monitoring',
    title: 'Review top 10 queries and position changes',
    detail:
      'Note any queries crossing into positions 1–20 (optimize those pages) and any new impressions on head terms (positions 50+ — ignore unless volume grows).',
    href: GSC_URL,
    external: true,
    cadence: 'monthly',
    sortOrder: 52,
  },
  {
    id: 'monitor-sitemap',
    category: 'ongoing-monitoring',
    title: 'Confirm sitemap lists all public SEO paths',
    detail:
      'Open /sitemap.xml on production. Verify new feature, compare, and help paths appear after content changes.',
    href: '/sitemap.xml',
    cadence: 'monthly',
    sortOrder: 53,
  },
  {
    id: 'monitor-rich-results-quarterly',
    category: 'ongoing-monitoring',
    title: 'Re-run Rich Results tests on key pages',
    detail:
      'Quarterly schema health check: homepage, pricing, one compare page, one feature page, one help guide.',
    href: RICH_RESULTS_URL,
    external: true,
    cadence: 'quarterly',
    sortOrder: 54,
  },

  // Content publishing checklist
  {
    id: 'publish-register-sitemap',
    category: 'content-publishing',
    title: 'Register new path in getAllPublicSeoPaths()',
    detail:
      'Add the page to lib/marketing/seoContent/ and ensure app/sitemap.ts includes it via getAllPublicSeoPaths().',
    cadence: 'once',
    sortOrder: 60,
  },
  {
    id: 'publish-related-links',
    category: 'content-publishing',
    title: 'Add relatedLinks on sibling SEO pages',
    detail:
      'Cross-link from at least two sibling feature, compare, or help pages using GSC-matched anchor text.',
    cadence: 'once',
    sortOrder: 61,
  },
  {
    id: 'publish-request-indexing',
    category: 'content-publishing',
    title: 'Request GSC indexing for the new URL',
    detail:
      'After deploy, use URL Inspection in Search Console to request indexing for the new or updated page.',
    href: GSC_URL,
    external: true,
    cadence: 'once',
    sortOrder: 62,
  },
  {
    id: 'publish-jsonld-tests',
    category: 'content-publishing',
    title: 'Extend seoJsonLd.test.ts if schema changed',
    detail:
      'Run npm test -- lib/marketing/seoJsonLd.test.ts after adding or changing JSON-LD builders.',
    cadence: 'once',
    sortOrder: 63,
  },
  {
    id: 'publish-update-admin-checklist',
    category: 'content-publishing',
    title: 'Add near-win verification task to SEO catalog if needed',
    detail:
      'If the page targets a new GSC query cluster, add a one-time near-win task to lib/admin/seoTaskCatalog.ts.',
    cadence: 'once',
    sortOrder: 64,
  },
];

export function getSeoTaskCadenceDays(cadence: SeoTaskCadence): number | null {
  switch (cadence) {
    case 'once':
      return null;
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
    default:
      return null;
  }
}

export function getSeoTaskCadenceLabel(cadence: SeoTaskCadence): string {
  switch (cadence) {
    case 'once':
      return 'One-time';
    case 'weekly':
      return 'Every week';
    case 'monthly':
      return 'Every month';
    case 'quarterly':
      return 'Every quarter';
    default:
      return cadence;
  }
}
