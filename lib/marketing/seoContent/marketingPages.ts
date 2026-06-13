import { COMPETITOR_COMPARE_PAGES } from './competitorComparePages';
import type { SeoMarketingPage } from './types';

export const FOR_PAGES: SeoMarketingPage[] = [
  {
    slug: 'residential-cleaning-companies',
    path: '/for/residential-cleaning-companies',
    metaTitle: 'Residential cleaning business software',
    metaDescription:
      'Quotes, recurring schedules, invoicing, and customer payments for residential cleaning companies. Built for maid services and house cleaning teams. 7-day free trial.',
    eyebrow: 'Residential cleaning',
    headline: 'Software built for residential cleaning companies',
    lead: 'Run quotes, recurring visits, crew schedules, and client payments from one workspace — without duct-taping spreadsheets and group texts together.',
    sections: [
      {
        title: 'Quote recurring homes with confidence',
        paragraphs: [
          'Residential work repeats — weekly bi-weekly, and move-out cleans all need clear pricing before you dispatch a crew. Clean Scheduler lets you send branded quotes with line items, then schedule the first visit when the customer accepts.',
        ],
        bullets: [
          'Pipeline from draft quote to accepted job',
          'Prefill the first visit from an accepted quote',
          'Separate recurring visit rules from billing plans',
        ],
        link: {
          href: '/help/cleaning-businesses/price-a-cleaning-job',
          label: 'How to price a cleaning job',
        },
      },
      {
        title: 'Keep recurring routes organized',
        paragraphs: [
          'See today’s homes on a calendar built for cleaning ops — assign employees, handle customer reschedule requests, and let field staff check in from their phones.',
        ],
        bullets: [
          'Day, week, and month schedule views',
          'Recurring visit rules for repeat clients',
          'Customer reschedule inbox with approve/deny',
        ],
        link: {
          href: '/features/scheduling-and-dispatch',
          label: 'Scheduling & dispatch features',
        },
      },
      {
        title: 'Get paid without the weekly chase',
        paragraphs: [
          'Invoice after each visit or on a billing cycle. Accept cards when you are ready, record cash and checks in the field, and match Zelle deposits when they land in your bank.',
        ],
        bullets: [
          'Outstanding balance reports by customer',
          'Stripe card payments on invoices (optional)',
          'Deposit matching for Zelle and ACH',
        ],
        link: {
          href: '/features/invoicing-and-payments',
          label: 'Invoicing & payments features',
        },
      },
    ],
    faq: [
      {
        question: 'Is Clean Scheduler only for residential cleaners?',
        answer:
          'We built the product for both residential and commercial cleaning businesses. Many teams run both — you can manage all accounts in one workspace.',
      },
      {
        question: 'Can solo owner-operators use Clean Scheduler?',
        answer:
          'Yes. Starter plans include the core quote → schedule → invoice workflow. Add field seats as you hire cleaners.',
      },
      {
        question: 'Do my customers get a portal?',
        answer:
          'Customer portals are available on Business and Pro plans. Clients can view upcoming cleanings, pay invoices, and request reschedules online.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-zenmaid', label: 'vs ZenMaid' },
      { href: '/compare/vs-launch27', label: 'vs Launch27' },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning software' },
      { href: '/compare/spreadsheets-and-texts', label: 'Spreadsheets vs Clean Scheduler' },
      { href: '/pricing', label: 'View pricing' },
    ],
    sitemapPriority: 0.85,
    changeFrequency: 'monthly',
  },
  {
    slug: 'commercial-cleaning-companies',
    path: '/for/commercial-cleaning-companies',
    metaTitle: 'Commercial cleaning & janitorial software',
    metaDescription:
      'Scheduling, quotes, invoicing, and AR for commercial cleaning and janitorial companies. Multi-site accounts and month-end reports. 7-day free trial.',
    eyebrow: 'Commercial cleaning',
    headline: 'Run commercial and janitorial accounts from one console',
    lead: 'Manage multi-site contracts, recurring crews, and accounts receivable without losing visibility across locations or billing contacts.',
    sections: [
      {
        title: 'Structure complex accounts',
        paragraphs: [
          'Commercial work often means multiple properties under one billing contact. Keep customer records, service locations, and visit history organized so your office team answers questions in seconds — not after searching inboxes.',
        ],
        bullets: [
          'Customer directory with property addresses',
          'Quotes with detailed line items per scope',
          'Visit history and proof-of-service photos on Business+',
        ],
      },
      {
        title: 'Schedule crews across sites',
        paragraphs: [
          'Assign teams to recurring janitorial routes and one-off projects. Field employees see their day on mobile-friendly views and can record payments or completion notes on site.',
        ],
        bullets: [
          'Recurring rules for contract frequencies',
          'Employee filters on calendar views',
          'Field check-in and visit completion workflow',
        ],
        link: {
          href: '/help/cleaning-businesses/recurring-cleaning-schedule',
          label: 'Set up recurring cleaning schedules',
        },
      },
      {
        title: 'Close the month with clean books',
        paragraphs: [
          'Commercial operators feel AR pain at month-end. Clean Scheduler gives bookkeepers collections reports, payment audit workflows, bank deposit matching, and payroll exports on higher tiers.',
        ],
        bullets: [
          'Outstanding invoices and collections reports',
          'Payment audits for check and cash collections',
          'Payroll export for ADP, Gusto, and QuickBooks (Business+)',
        ],
        link: {
          href: '/help/cleaning-businesses/month-end-close',
          label: 'Month-end close guide',
        },
      },
    ],
    faq: [
      {
        question: 'Can we manage both commercial and residential clients?',
        answer:
          'Yes. Clean Scheduler supports mixed books — use customer tags and property records to keep account types clear in reports.',
      },
      {
        question: 'Do you support contract billing?',
        answer:
          'You can invoice on recurring schedules and track subscription-style customer plans. Service plans and customer subscriptions are available when Stripe Connect is set up.',
      },
      {
        question: 'Is there role-based access for office vs field staff?',
        answer:
          'Business and Pro plans include admin and viewer roles so office managers and bookkeepers see what they need without full owner access.',
      },
    ],
    relatedLinks: [
      { href: '/for/residential-cleaning-companies', label: 'Residential cleaning software' },
      { href: '/features/invoicing-and-payments', label: 'Invoicing & payments' },
      { href: '/pricing', label: 'View pricing' },
    ],
    sitemapPriority: 0.85,
    changeFrequency: 'monthly',
  },
];

export const FEATURE_PAGES: SeoMarketingPage[] = [
  {
    slug: 'scheduling-and-dispatch',
    path: '/features/scheduling-and-dispatch',
    metaTitle: 'Cleaning company scheduling software',
    metaDescription:
      'Route-aware scheduling for cleaning businesses: recurring visits, crew assignment, customer reschedule requests, and mobile field views. Try free for 7 days.',
    eyebrow: 'Scheduling',
    headline: 'Scheduling and dispatch built for cleaning crews',
    lead: 'Plan recurring routes, assign employees, and handle customer schedule changes — without double-booking your team or losing context in text threads.',
    sections: [
      {
        title: 'Calendar views your office actually uses',
        paragraphs: [
          'Switch between day, week, and month views filtered by employee or customer. Recurring visit rules keep weekly and bi-weekly homes on autopilot while still letting you override single dates.',
        ],
        bullets: [
          'Drag-and-drop day scheduling',
          'Recurring visit rules separate from billing',
          'Conflict visibility when assigning crews',
        ],
      },
      {
        title: 'Customer reschedule requests in one inbox',
        paragraphs: [
          'When clients need to move a cleaning, they can request new times from the customer portal (Business+). Your office approves or denies without playing phone tag.',
        ],
        bullets: [
          'Reschedule request queue for office staff',
          'Customer portal integration on Business+',
          'Audit trail of schedule changes',
        ],
        link: {
          href: '/help/cleaning-businesses/customer-portal',
          label: 'Customer portal guide',
        },
      },
      {
        title: 'Field-friendly mobile workflow',
        paragraphs: [
          'Crews check in, complete visits, capture proof photos on Business+, and record on-site payments. Owners see status from the dashboard without calling the team.',
        ],
        bullets: [
          'Visit check-in and completion',
          'Proof-of-service photos (Business+)',
          'On-site payment recording',
        ],
      },
    ],
    faq: [
      {
        question: 'Can I schedule both one-time and recurring jobs?',
        answer:
          'Yes. One-time visits and recurring rules coexist on the same calendar. Billing recurrence is configured separately when you invoice.',
      },
      {
        question: 'Do employees need their own login?',
        answer:
          'Field employees get a simplified schedule view. Office seats (owner, admin, viewer) manage the full calendar.',
      },
    ],
    relatedLinks: [
      { href: '/for/residential-cleaning-companies', label: 'Residential cleaning' },
      { href: '/features/invoicing-and-payments', label: 'Invoicing & payments' },
      { href: '/start-trial', label: 'Start free trial' },
    ],
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    slug: 'invoicing-and-payments',
    path: '/features/invoicing-and-payments',
    metaTitle: 'Cleaning business invoicing & payments',
    metaDescription:
      'Invoice cleaning clients, accept cards via Stripe, record cash and checks, and match Zelle deposits to open invoices. Built for cleaning company AR.',
    eyebrow: 'Payments',
    headline: 'Invoicing and payments for cleaning businesses',
    lead: 'Send professional invoices, accept cards when you are ready, and track every payment method your customers actually use — including Zelle and checks.',
    sections: [
      {
        title: 'From accepted quote to paid invoice',
        paragraphs: [
          'Convert completed work into invoices without re-entering line items. Email invoices to customers and track open balances from your billing hub.',
        ],
        bullets: [
          'Invoice creation from visits and quotes',
          'Email delivery with PDF attachment',
          'Outstanding balance snapshots',
        ],
        link: {
          href: '/help/cleaning-businesses/price-a-cleaning-job',
          label: 'Pricing jobs guide',
        },
      },
      {
        title: 'Accept card payments on your invoices',
        paragraphs: [
          'Connect Stripe once to add secure pay links to invoices. Funds settle to your connected account — separate from your Clean Scheduler subscription.',
        ],
        bullets: [
          'Stripe Connect onboarding in the app',
          'Card checkout links on open invoices',
          'Payment ledger for all customer payments',
        ],
        link: {
          href: '/help/cleaning-businesses/get-paid-zelle-and-cards',
          label: 'Get paid with cards and Zelle',
        },
      },
      {
        title: 'Match Zelle and bank deposits',
        paragraphs: [
          'Clean Scheduler does not connect to Zelle directly. When you link your business bank account, deposit matching helps tie Zelle, ACH, and wire deposits to the right invoice.',
        ],
        bullets: [
          'Plaid bank connection on Business+',
          'Suggested matches with confidence scores',
          'CSV import fallback for bank statements',
        ],
      },
    ],
    faq: [
      {
        question: 'Is Stripe required?',
        answer:
          'No. You can record cash, check, and other manual payments without Stripe. Card acceptance requires Stripe Connect.',
      },
      {
        question: 'How is platform billing different from customer payments?',
        answer:
          'Your Clean Scheduler subscription is billed separately from payments you collect from cleaning clients via your own Stripe account.',
      },
    ],
    relatedLinks: [
      { href: '/features/scheduling-and-dispatch', label: 'Scheduling features' },
      { href: '/help/cleaning-businesses/get-paid-zelle-and-cards', label: 'Get paid guide' },
      { href: '/pricing', label: 'View pricing' },
    ],
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
];

export const COMPARE_PAGES: SeoMarketingPage[] = [
  {
    slug: 'spreadsheets-and-texts',
    path: '/compare/spreadsheets-and-texts',
    metaTitle: 'Spreadsheets vs cleaning business software',
    metaDescription:
      'Compare running a cleaning business on spreadsheets and group texts vs Clean Scheduler. See when to upgrade to quotes, scheduling, and invoicing in one system.',
    eyebrow: 'Compare',
    headline: 'Spreadsheets and group texts only get you so far',
    lead: 'Many cleaning companies start with free tools. Here is an honest look at when a dedicated system saves time — and what changes when you switch.',
    sections: [
      {
        title: 'What spreadsheets do well',
        paragraphs: [
          'Spreadsheets are free, flexible, and fine when you are solo with a handful of weekly clients. They break down when multiple people need the same live schedule or when AR spans dozens of open invoices.',
        ],
        bullets: [
          'Good for: solo operators, simple price lists, basic tracking',
          'Pain points: version conflicts, no customer portal, manual invoice math',
          'Hidden cost: office time reconciling texts, emails, and payment screenshots',
        ],
      },
      {
        title: 'What Clean Scheduler adds',
        paragraphs: [
          'One workspace connects quotes, scheduling, customer records, and billing. Your team sees the same data, customers get consistent invoices, and bookkeepers get reports built for month-end close.',
        ],
        bullets: [
          'Single source of truth for customers and visits',
          'Automated recurring schedule rules',
          'Invoice and payment tracking with deposit matching',
          'Optional customer portal on Business+',
        ],
      },
      {
        title: 'A practical migration path',
        paragraphs: [
          'You do not need to move every client on day one. Most owners import active customers, schedule the next two weeks of work, and send new invoices from Clean Scheduler while finishing open AR from the old system.',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
    ],
    faq: [
      {
        question: 'Can I export data if I leave?',
        answer:
          'Customer, visit, and billing records belong to your workspace. Contact support for export options before deleting a workspace.',
      },
      {
        question: 'Do I need to enter a credit card for the trial?',
        answer: 'No. The 7-day trial includes core workflows with no credit card required.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-jobber', label: 'vs Jobber' },
      { href: '/compare/vs-zenmaid', label: 'vs ZenMaid' },
      {
        href: '/compare/vs-generic-field-service-software',
        label: 'vs generic field service tools',
      },
      { href: '/why-cleanscheduler', label: 'Why Clean Scheduler' },
      { href: '/pricing', label: 'Pricing' },
    ],
    sitemapPriority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    slug: 'vs-generic-field-service-software',
    path: '/compare/vs-generic-field-service-software',
    metaTitle: 'Cleaning software vs generic field service tools',
    metaDescription:
      'Why cleaning businesses choose software built for residential and commercial cleaning instead of generic HVAC, lawn, or field service platforms.',
    eyebrow: 'Compare',
    headline: 'Built for cleaning — not every trade under the sun',
    lead: 'Generic field service tools cover many industries. Clean Scheduler focuses on the workflows cleaning companies repeat every week: recurring homes, commercial routes, quotes, and AR.',
    sections: [
      {
        title: 'Workflows that match how you sell cleaning',
        paragraphs: [
          'Cleaning quotes often bundle rooms, frequency, and add-ons — not parts and truck rolls. Our quote pipeline, visit scheduling, and invoice line items reflect residential and commercial cleaning scopes out of the box.',
        ],
      },
      {
        title: 'Payments your customers actually use',
        paragraphs: [
          'Cleaning clients pay by card, check, cash, and Zelle. Clean Scheduler records manual payments in the field, accepts cards via Stripe, and helps match bank deposits — without treating every job like a dispatch ticket.',
        ],
        link: {
          href: '/help/cleaning-businesses/get-paid-zelle-and-cards',
          label: 'Payment methods guide',
        },
      },
      {
        title: 'Bookkeeping reports for cleaning operators',
        paragraphs: [
          'Collections, payment audits, bank reconciliation, and payroll exports are ordered for month-end close — not bolted on as generic “reporting modules.”',
        ],
        link: { href: '/help/cleaning-businesses/month-end-close', label: 'Month-end close guide' },
      },
    ],
    faq: [
      {
        question: 'Do you support both residential and commercial?',
        answer:
          'Yes. One workspace can run mixed books with property-level detail for commercial sites and recurring home schedules for residential clients.',
      },
      {
        question: 'Can I use Clean Scheduler if I also offer related services?',
        answer:
          'The product is optimized for cleaning operations. Related services can be quoted as line items, but deep trade-specific workflows (HVAC parts, etc.) are out of scope.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-jobber', label: 'vs Jobber' },
      { href: '/compare/spreadsheets-and-texts', label: 'Spreadsheets vs software' },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning' },
      { href: '/pricing', label: 'Pricing' },
    ],
    sitemapPriority: 0.75,
    changeFrequency: 'monthly',
  },
  ...COMPETITOR_COMPARE_PAGES,
];

export const WHY_CLEANSCHEDULER_PAGE: SeoMarketingPage = {
  slug: 'why-cleanscheduler',
  path: '/why-cleanscheduler',
  metaTitle: 'Why Clean Scheduler for cleaning businesses',
  metaDescription:
    'Quotes, scheduling, invoicing, customer portals, and month-end reports — purpose-built for residential and commercial cleaning companies.',
  eyebrow: 'Why Clean Scheduler',
  headline: 'One system for owners, office managers, and bookkeepers',
  lead: 'Clean Scheduler connects the workflows cleaning teams repeat every day — from the first quote to getting paid and closing the month.',
  sections: [
    {
      title: 'For owners growing without chaos',
      paragraphs: [
        'Stop juggling spreadsheets, group texts, and disconnected payment apps. See today’s jobs, open quotes, and outstanding AR from a single dashboard.',
      ],
      bullets: [
        '7-day free trial, no credit card required',
        'Plans from solo operators to multi-crew companies',
        'Upgrade path to customer portal, campaigns, and analytics',
      ],
    },
    {
      title: 'For office managers running the day',
      paragraphs: [
        'Schedule crews, answer customer questions, and handle reschedule requests without digging through inboxes. Everyone works from the same customer and visit records.',
      ],
      bullets: [
        'Calendar with recurring visit rules',
        'Customer directory with property details',
        'Reschedule request inbox (Business+)',
      ],
    },
    {
      title: 'For bookkeepers closing the month',
      paragraphs: [
        'Collections reports, payment audits, bank deposit matching, and payroll exports help you reconcile AR faster — especially when clients pay by Zelle or check.',
      ],
      bullets: [
        'Outstanding invoice and collections reports',
        'Deposit matching for bank transfers (Business+)',
        'Payroll export layouts for common providers',
      ],
      link: { href: '/help/cleaning-businesses/month-end-close', label: 'Month-end close guide' },
    },
  ],
  faq: [
    {
      question: 'Who is Clean Scheduler for?',
      answer:
        'Residential and commercial cleaning companies in the United States — owner-operators through multi-crew operations.',
    },
    {
      question: 'What makes it different from generic tools?',
      answer:
        'We focus on cleaning-specific workflows: recurring home schedules, commercial properties, quote-to-invoice, Zelle deposit matching, and month-end close — not one-size-fits-all field service.',
    },
  ],
  relatedLinks: [
    { href: '/compare', label: 'Compare Clean Scheduler' },
    { href: '/for/residential-cleaning-companies', label: 'Residential cleaning' },
    { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning' },
    { href: '/pricing', label: 'Pricing' },
  ],
  ctaTitle: 'See it in your workspace',
  ctaLead:
    'Start a 7-day free trial and run your next quote, visit, and invoice in Clean Scheduler.',
  sitemapPriority: 0.8,
  changeFrequency: 'monthly',
};

export const ALL_SEO_MARKETING_PAGES: SeoMarketingPage[] = [
  ...FOR_PAGES,
  ...FEATURE_PAGES,
  ...COMPARE_PAGES,
  WHY_CLEANSCHEDULER_PAGE,
];

export function getSeoMarketingPageBySlug(
  segment: 'for' | 'features' | 'compare',
  slug: string,
): SeoMarketingPage | undefined {
  const pages =
    segment === 'for' ? FOR_PAGES : segment === 'features' ? FEATURE_PAGES : COMPARE_PAGES;
  return pages.find((page) => page.slug === slug);
}
