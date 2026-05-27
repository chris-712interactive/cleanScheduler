import type { HelpArticleEntry, HelpCategory } from './types';

export const HELP_HUB_CATEGORIES: HelpCategory[] = [
  {
    slug: 'customers',
    path: '/help/customers',
    title: 'For Customers',
    description: 'Guides for homeowners and customer portal users.',
    audience: 'customers',
    sectionTitle: 'Top tasks',
    cards: [
      {
        title: 'Get started with your portal',
        description: 'Accept invite, create password, and enable SMS updates.',
        href: '/help/tcr',
        hrefLabel: 'SMS opt-in and compliance details',
        badges: [{ label: 'Public' }, { label: 'How-to' }],
      },
      {
        title: 'Manage appointments',
        description: 'View upcoming jobs, request reschedules, and message your provider.',
        comingSoon: true,
        badges: [{ label: 'Coming soon' }],
      },
      {
        title: 'Pay invoices',
        description: 'Open invoices, review line items, and complete payment.',
        comingSoon: true,
        badges: [{ label: 'Coming soon' }],
      },
    ],
  },
  {
    slug: 'developers',
    path: '/help/developers',
    title: 'For Developers',
    description: 'API and webhook documentation for external integrators.',
    audience: 'developers',
    sectionTitle: 'Core sections',
    cards: [
      {
        title: 'Authentication',
        description: 'How API keys are generated, stored, and passed in requests.',
        comingSoon: true,
        badges: [{ label: 'Guide' }, { label: 'Coming soon' }],
      },
      {
        title: 'REST API',
        description: 'Endpoint families, request examples, pagination, and error handling.',
        comingSoon: true,
        badges: [{ label: 'Reference' }, { label: 'Coming soon' }],
      },
      {
        title: 'Webhooks',
        description: 'Event catalog, signature verification, retry behavior, and idempotency.',
        comingSoon: true,
        badges: [{ label: 'Reference' }, { label: 'Security' }, { label: 'Coming soon' }],
      },
    ],
  },
  {
    slug: 'compliance',
    path: '/help/compliance',
    title: 'Compliance & Policy',
    description: 'Reviewer-friendly compliance documentation and policy links.',
    audience: 'compliance',
    sectionTitle: 'Compliance library',
    cards: [
      {
        title: 'TCR documentation',
        description: 'Campaign details, opt-in flow proof, keyword handling, and templates.',
        href: '/help/tcr',
        hrefLabel: 'Open TCR documentation',
        badges: [{ label: 'Compliance' }, { label: 'Reviewer-ready' }],
      },
      {
        title: 'Privacy policy',
        description: 'Data handling practices and third-party service processing disclosures.',
        href: '/privacy',
        hrefLabel: 'Open privacy policy',
        badges: [{ label: 'Legal' }],
      },
      {
        title: 'SMS terms',
        description: 'Program description, frequency, rate disclosures, and STOP/HELP language.',
        href: '/sms-terms',
        hrefLabel: 'Open SMS terms',
        badges: [{ label: 'Legal' }],
      },
    ],
  },
];

export const HELP_HUB_LINKS = [
  {
    title: 'FAQ',
    description: 'Common questions about trials, billing, and platform features.',
    href: '/help/faq',
    badges: [{ label: 'General' }],
  },
  {
    title: 'Contact support',
    description: 'When to contact sales, support, or legal.',
    href: '/help/contact',
    badges: [{ label: 'Support' }],
  },
] as const;

export const HELP_ARTICLES: HelpArticleEntry[] = [
  { path: '/help', title: 'Help Center', description: 'Public help documentation hub.' },
  {
    path: '/help/customers',
    title: 'Customer Help',
    description: 'Help for homeowners and customer portal users.',
  },
  {
    path: '/help/developers',
    title: 'Developer Help',
    description: 'API and webhook documentation for integrators.',
  },
  {
    path: '/help/compliance',
    title: 'Compliance Help',
    description: 'Compliance documentation and policy links.',
  },
  {
    path: '/help/faq',
    title: 'FAQ',
    description: 'Frequently asked questions about cleanScheduler.',
  },
  {
    path: '/help/contact',
    title: 'Contact Support',
    description: 'How to reach sales, support, and legal.',
  },
  {
    path: '/help/tcr',
    title: 'TCR Documentation',
    description: 'TCR compliance documentation for 10DLC review.',
    priority: 0.3,
    changeFrequency: 'monthly',
  },
];

export function getHelpCategory(slug: string): HelpCategory | undefined {
  return HELP_HUB_CATEGORIES.find((category) => category.slug === slug);
}
