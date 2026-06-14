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
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning schedule software' },
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
      { href: '/features/stripe-integration', label: 'Stripe integration for cleaning companies' },
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
  {
    slug: 'how-to-get-commercial-cleaning-accounts',
    path: '/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts',
    title: 'How to get commercial cleaning accounts',
    description:
      'A practical guide to winning janitorial and commercial cleaning contracts — prospecting, RFPs, quoting, and onboarding accounts your office can actually run.',
    sections: [
      {
        title: 'Where commercial cleaning contracts come from',
        paragraphs: [
          'Commercial accounts rarely appear from a single ad. Most cleaning companies build a pipeline from relationships, referrals, and repeat bidding. Focus on channels where facilities decision-makers already look for vendors.',
        ],
        bullets: [
          'Property management companies and facility managers',
          'Office buildings, medical clinics, schools, and retail centers',
          'Referrals from existing residential clients who manage small offices',
          'Local business networking groups and chamber of commerce events',
          'Public RFPs and bid boards for government or institutional work',
        ],
      },
      {
        title: 'Get your business ready before you pitch',
        paragraphs: [
          'Commercial buyers ask about insurance, references, and consistency before price. Have these ready so you can respond the same day a prospect calls.',
        ],
        bullets: [
          'General liability and workers comp certificates (COIs)',
          'Two or three references from similar-sized accounts',
          'A scope template: restrooms, break rooms, trash, floors, frequency',
          'Clear service-level expectations for after-hours access',
        ],
        tip: 'Save a one-page capabilities sheet (crew size, service area, insurance limits) you can email within minutes of a lead.',
      },
      {
        title: 'Quote commercial scopes professionally',
        paragraphs: [
          'Commercial quotes should break work into line items per site — not a single lump sum. Show frequency, square footage assumptions, and add-ons like floor waxing or window cleaning. A detailed quote signals you can manage multi-site contracts after you win them.',
        ],
        bullets: [
          'Price per visit or monthly contract with clear inclusions',
          'Separate line items for each property under one billing contact',
          'Walk-through notes attached to the quote for your crew',
        ],
        link: {
          href: '/help/cleaning-businesses/price-a-cleaning-job',
          label: 'How to price a cleaning job',
        },
      },
      {
        title: 'Follow up and close without being pushy',
        paragraphs: [
          'Commercial sales cycles run weeks to months. Send the quote, confirm receipt, and schedule a follow-up before you leave the walk-through. Ask what would prevent them from starting next month — budget, incumbent contract end date, or internal approval.',
        ],
        bullets: [
          'Follow up 3–5 business days after sending the quote',
          'Offer a short pilot clean for skeptical facilities managers',
          'Ask when their current contract ends — timing wins contracts',
        ],
      },
      {
        title: 'Onboard won accounts without chaos',
        paragraphs: [
          'The first 30 days set the tone. Document access codes, alarm instructions, supply closets, and billing contacts before the first scheduled visit. Once accounts are live, run recurring crew schedules, visit history, and invoicing from one system so the office does not revert to spreadsheets.',
        ],
        bullets: [
          'Create one customer record per billing contact with multiple properties',
          'Set recurring visit rules for each site frequency',
          'Invoice on net terms with collections reports for month-end',
        ],
        link: {
          href: '/for/commercial-cleaning-companies',
          label: 'Commercial cleaning scheduling software',
        },
      },
    ],
    faq: [
      {
        question: 'How big are typical commercial cleaning contracts?',
        answer:
          'Small office contracts might be a few hundred dollars per month. Multi-site property management accounts can reach thousands per month. Start with one building or a pilot scope to prove consistency before bidding large portfolios.',
      },
      {
        question: 'Is selling commercial cleaning different from residential?',
        answer:
          'Yes. Residential is often faster and emotional (trust in your team). Commercial is slower, more formal, and driven by price, insurance, references, and reliability. You will quote in writing more often and wait longer for decisions.',
      },
      {
        question: 'How long does it take to win a commercial account?',
        answer:
          'Simple office contracts can close in 2–4 weeks. RFP-driven institutional work often takes 1–3 months. Relationship-based property management deals may take a full contract cycle (6–12 months) if you are displacing an incumbent.',
      },
    ],
    relatedLinks: [
      {
        href: '/for/commercial-cleaning-companies',
        label: 'Commercial cleaning scheduling software',
      },
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning schedule software' },
      { href: '/features/stripe-integration', label: 'Stripe integration' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/start-trial', label: 'Start free trial' },
    ],
    sitemapPriority: 0.7,
    changeFrequency: 'monthly',
  },
];

export function getCleaningBusinessArticle(slug: string): HelpGuideArticle | undefined {
  return CLEANING_BUSINESS_ARTICLES.find((article) => article.slug === slug);
}
