import type { HelpGuideArticle } from './types';

export const CLEANING_BUSINESS_HUB = {
  slug: 'cleaning-businesses',
  path: '/help/cleaning-businesses',
  title: 'Guides for cleaning businesses',
  description:
    'Practical how-to guides for owners and office managers — pricing jobs, scheduling recurring work, getting paid, and closing the month.',
  sectionTitle: 'Owner & office guides',
};

export const CLEANING_BUSINESS_ARTICLES: HelpGuideArticle[] = [
  {
    slug: 'price-a-cleaning-job',
    path: '/help/cleaning-businesses/price-a-cleaning-job',
    title: 'How to price a house cleaning job',
    description:
      'A practical framework for quoting residential and commercial cleaning jobs — and how to send the estimate from Clean Scheduler.',
    sections: [
      {
        title: 'Start with scope, not a flat guess',
        paragraphs: [
          'Reliable quotes break work into rooms, frequency, and add-ons (oven, fridge, windows). Even if you use flat rates by bed/bath count, document what is included so customers and crews agree.',
        ],
        bullets: [
          'Square footage or room count as the base',
          'Frequency discount for weekly vs bi-weekly',
          'Add-ons priced separately with clear labels',
        ],
      },
      {
        title: 'Build the quote in Clean Scheduler',
        paragraphs: [
          'Create a quote with line items your customer can understand. Send it from the app, track status on the pipeline board, and schedule the first visit when they accept.',
        ],
        bullets: [
          'Add line items with descriptions and quantities',
          'Move quotes from draft → sent → accepted',
          'Prefill the first visit from an accepted quote',
        ],
        tip: 'Keep a few quote templates for your most common packages (standard clean, deep clean, move-out) to speed up estimates.',
      },
      {
        title: 'Convert accepted work to invoices',
        paragraphs: [
          'When the job is done — or on your billing cycle — convert visits or quote totals into invoices without retyping amounts.',
        ],
      },
    ],
    faq: [
      {
        question: 'Should I quote hourly or flat rate?',
        answer:
          'Many residential cleaners quote flat rates by home size for predictability. Commercial scopes often use line items per site. Clean Scheduler supports both via flexible line items.',
      },
    ],
    relatedLinks: [
      { href: '/for/residential-cleaning-companies', label: 'Residential cleaning software' },
      { href: '/features/invoicing-and-payments', label: 'Invoicing features' },
      { href: '/start-trial', label: 'Start free trial' },
    ],
    sitemapPriority: 0.65,
    changeFrequency: 'monthly',
  },
  {
    slug: 'recurring-cleaning-schedule',
    path: '/help/cleaning-businesses/recurring-cleaning-schedule',
    title: 'Set up a recurring cleaning schedule',
    description:
      'Configure weekly and bi-weekly visit rules, assign crews, and handle exceptions without rebuilding the calendar every Sunday night.',
    sections: [
      {
        title: 'Separate visits from billing',
        paragraphs: [
          'In Clean Scheduler, recurring visit rules control when crews go out. Billing recurrence (monthly invoices, service plans) is configured separately — so a skipped visit does not automatically break your invoice logic.',
        ],
      },
      {
        title: 'Create a recurring visit rule',
        paragraphs: [
          'From the schedule, define frequency, start date, default assignees, and the customer property. The calendar generates upcoming visits automatically.',
        ],
        bullets: [
          'Weekly, bi-weekly, and custom RRULE patterns',
          'Default employee assignment per rule',
          'Edit single occurrences without deleting the series',
        ],
      },
      {
        title: 'Handle changes gracefully',
        paragraphs: [
          'Customers reschedule, crews call in sick, and skip weeks happen. Use the reschedule inbox (Business+) or drag visits on the calendar, and keep audit history for the office.',
        ],
      },
    ],
    faq: [
      {
        question: 'Can one customer have multiple recurring rules?',
        answer:
          'Yes — for example a weekly home clean plus a quarterly deep clean can be separate rules on the same customer account.',
      },
    ],
    relatedLinks: [
      { href: '/features/scheduling-and-dispatch', label: 'Scheduling features' },
      { href: '/help/cleaning-businesses/customer-portal', label: 'Customer portal guide' },
      { href: '/start-trial', label: 'Start free trial' },
    ],
    sitemapPriority: 0.65,
    changeFrequency: 'monthly',
  },
  {
    slug: 'get-paid-zelle-and-cards',
    path: '/help/cleaning-businesses/get-paid-zelle-and-cards',
    title: 'Get paid with cards, Zelle, and checks',
    description:
      'How cleaning companies accept card payments, record cash and checks, and match Zelle deposits to invoices in Clean Scheduler.',
    sections: [
      {
        title: 'Card payments (optional)',
        paragraphs: [
          'Connect Stripe from Billing → Accept card payments. Once live, invoices can include a secure pay link. Card payments are separate from your Clean Scheduler subscription.',
        ],
        bullets: [
          'One-time Stripe Connect onboarding',
          'Pay links on open invoices',
          'Payments appear in the customer payment ledger',
        ],
      },
      {
        title: 'Cash and checks in the field',
        paragraphs: [
          'Record manual payments when crews collect on site or when checks arrive at the office. Payment audits (Business+) help confirm offline collections before month-end close.',
        ],
      },
      {
        title: 'Zelle and bank deposits',
        paragraphs: [
          'Clean Scheduler does not connect to Zelle directly. Link your business bank account on Business+ and use deposit matching to tie incoming transfers to open invoices.',
        ],
        bullets: [
          'Plaid bank connection for transaction sync',
          'Suggested invoice matches with confidence scores',
          'CSV import if you prefer statement uploads',
        ],
        tip: 'Ask customers to include invoice number or address in Zelle memos — it makes matching much faster.',
      },
    ],
    faq: [
      {
        question: 'Do I need Stripe for Zelle tracking?',
        answer:
          'No. Stripe is only for card payments. Zelle tracking uses bank deposit matching after funds arrive in your account.',
      },
    ],
    relatedLinks: [
      { href: '/features/invoicing-and-payments', label: 'Invoicing & payments' },
      { href: '/for/residential-cleaning-companies', label: 'Residential cleaning' },
      { href: '/pricing', label: 'Pricing' },
    ],
    sitemapPriority: 0.65,
    changeFrequency: 'monthly',
  },
  {
    slug: 'month-end-close',
    path: '/help/cleaning-businesses/month-end-close',
    title: 'Month-end close for cleaning companies',
    description:
      'A practical month-end checklist: collections, payment audits, bank matching, and payroll exports in Clean Scheduler.',
    sections: [
      {
        title: '1. Review open invoices',
        paragraphs: [
          'Start with outstanding balance and collections reports. Follow up on past-due residential and commercial accounts before closing the period.',
        ],
      },
      {
        title: '2. Confirm offline payments',
        paragraphs: [
          'Run payment audits to verify cash and check collections recorded in the field match what hit your bank or desk drawer.',
        ],
      },
      {
        title: '3. Match bank deposits',
        paragraphs: [
          'Use deposit matching to clear Zelle, ACH, and wire deposits against open invoices. Resolve unmatched items before exporting payroll.',
        ],
      },
      {
        title: '4. Export payroll (Business+)',
        paragraphs: [
          'Generate payroll exports formatted for generic CSV, ADP, Gusto, or QuickBooks based on completed visits and compensation rules configured in settings.',
        ],
        tip: 'The reports hub orders these steps in a month-end close checklist so new bookkeepers do not miss a stage.',
      },
    ],
    faq: [
      {
        question: 'Does Clean Scheduler sync live with QuickBooks?',
        answer:
          'Not today. Business and Pro plans include payroll and financial exports you can import — not continuous accounting sync.',
      },
    ],
    relatedLinks: [
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning' },
      {
        href: '/compare/vs-generic-field-service-software',
        label: 'Why cleaning-specific software',
      },
      { href: '/pricing', label: 'Pricing' },
    ],
    sitemapPriority: 0.65,
    changeFrequency: 'monthly',
  },
  {
    slug: 'customer-portal',
    path: '/help/cleaning-businesses/customer-portal',
    title: 'Customer portal for cleaning clients',
    description:
      'What your cleaning customers see in the portal — upcoming visits, invoices, payments, and reschedule requests (Business plan and above).',
    sections: [
      {
        title: 'What customers can do',
        paragraphs: [
          'On Business and Pro plans, each client gets a branded portal under your workspace. They sign in with email to view their relationship with your company — not a generic marketplace account.',
        ],
        bullets: [
          'View upcoming and past cleanings',
          'Open and pay invoices online (with Stripe Connect)',
          'Request reschedule times (Business+)',
        ],
      },
      {
        title: 'What you control',
        paragraphs: [
          'You decide when to invite customers, what they see, and whether white-label custom domains are used (Pro). Office staff approve or deny reschedule requests from the schedule inbox.',
        ],
      },
      {
        title: 'When to turn it on',
        paragraphs: [
          'Portals help when you field the same questions daily: “When is my next clean?” “What do I owe?” Enable after your core schedule and invoicing workflows are stable — usually within the first few weeks on the platform.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is the customer portal included on Starter?',
        answer:
          'Customer portals require Business or Pro. Starter includes core team workflows without client-facing portal access.',
      },
    ],
    relatedLinks: [
      { href: '/features/scheduling-and-dispatch', label: 'Scheduling features' },
      {
        href: '/help/cleaning-businesses/get-paid-zelle-and-cards',
        label: 'Payment methods guide',
      },
      { href: '/pricing', label: 'Compare plans' },
    ],
    sitemapPriority: 0.65,
    changeFrequency: 'monthly',
  },
];

export function getCleaningBusinessArticle(slug: string): HelpGuideArticle | undefined {
  return CLEANING_BUSINESS_ARTICLES.find((article) => article.slug === slug);
}
