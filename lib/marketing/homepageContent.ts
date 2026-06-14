import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';

export type MarketingFeatureShowcase = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
  tierBadge?: {
    label: string;
    tier: PlatformPlanTier;
  };
};

export type MarketingPersona = {
  title: string;
  subtitle: string;
  pain: string;
  solution: string;
};

export type MarketingFaqItem = {
  question: string;
  answer: string;
};

export const MARKETING_HERO = {
  eyebrow: 'Built for residential & commercial cleaning',
  title: 'Run your cleaning business from one console',
  lead: 'Schedule crews, send quotes, invoice clients, and close the books — with a branded customer portal your clients actually use.',
  note: '7-day free trial · No credit card required · Cancel anytime',
};

export const MARKETING_PERSONAS: MarketingPersona[] = [
  {
    title: 'Owner',
    subtitle: 'Grow without the chaos',
    pain: 'Stop juggling spreadsheets, group texts, and five different apps.',
    solution: 'One workspace for quotes, scheduling, billing, and team visibility.',
  },
  {
    title: 'Office manager',
    subtitle: 'Run the day smoothly',
    pain: 'Need today’s jobs, reschedule requests, and customer details in one place.',
    solution: 'Dashboard, calendar, and customer records built for cleaning ops.',
  },
  {
    title: 'Bookkeeper',
    subtitle: 'Close the month with confidence',
    pain: 'Chasing AR, matching Zelle deposits, and prepping payroll exports takes forever.',
    solution: 'Month-end close workflow, bank reconciliation, and payroll-ready reports.',
  },
];

export const MARKETING_FEATURE_SHOWCASES: MarketingFeatureShowcase[] = [
  {
    id: 'schedule',
    eyebrow: 'Scheduling',
    title: 'Route-aware scheduling for your crew',
    description:
      'Day, week, and month views with recurring visits, employee filters, and reschedule requests from customers — all in one calendar.',
    bullets: [
      'Drag-and-drop day views with assignees',
      'Recurring cleaning rules separate from billing',
      'Customer reschedule inbox with approve/deny',
    ],
    imageSrc: '/marketing/feature-schedule.png',
    imageAlt: 'Clean Scheduler schedule view showing cleaning visits on a day calendar',
  },
  {
    id: 'quotes',
    eyebrow: 'Sales',
    title: 'Quotes that close faster',
    description:
      'Send branded estimates with line items and photos. When a quote is accepted, schedule the first visit in one click.',
    bullets: [
      'Pipeline board from draft to accepted',
      'Prefill visits from accepted quotes',
      'Convert accepted work to invoices',
    ],
    imageSrc: '/marketing/feature-quotes.png',
    imageAlt: 'Clean Scheduler quotes pipeline with estimate cards by status',
  },
  {
    id: 'billing',
    eyebrow: 'Payments',
    title: 'Get paid without the chase',
    description:
      'Invoice customers, accept cards and ACH via Stripe Connect, and track Zelle and check payments through your linked bank account.',
    bullets: [
      'Outstanding balance and collections reports',
      'Manual payment recording for checks and cash',
      'Payment audit workflow for field collections',
    ],
    imageSrc: '/marketing/feature-billing.png',
    imageAlt: 'Clean Scheduler invoice list with payment status and amounts due',
  },
  {
    id: 'customer-portal',
    eyebrow: 'Customer experience',
    title: 'A branded portal your customers use',
    description:
      'Give every client a clear view of upcoming cleanings, open quotes, and balances due — under your business name.',
    bullets: [
      'Upcoming visits and service history',
      'Pay invoices and manage subscriptions',
      'Request reschedule times online',
    ],
    imageSrc: '/marketing/feature-customers.png',
    imageAlt: 'Clean Scheduler customer directory with residential and commercial accounts',
    tierBadge: { label: 'Business plan', tier: 'business' },
  },
  {
    id: 'campaigns',
    eyebrow: 'Marketing',
    title: 'Email campaigns to fill your calendar',
    description:
      'Send promotional emails to opted-in customers with open and click tracking — perfect for slow seasons and new service launches.',
    bullets: [
      'Audience presets from your customer list',
      'Branded sends with CAN-SPAM footer',
      'Draft, schedule, and performance metrics',
    ],
    imageSrc: '/marketing/feature-portals.png',
    imageAlt: 'Clean Scheduler workspace billing hub showing customer AR tools',
    tierBadge: { label: 'Business plan', tier: 'business' },
  },
  {
    id: 'reports',
    eyebrow: 'Bookkeeping',
    title: 'Month-end close built for cleaning bookkeepers',
    description:
      'Run collections, payment audits, bank matching, payroll exports, and year-end prep from one reports hub.',
    bullets: [
      'Ordered month-end close checklist',
      'Payroll export for ADP, Gusto, and QuickBooks (Business+)',
      'Advanced analytics and forecasting on Pro',
    ],
    imageSrc: '/marketing/feature-reports.png',
    imageAlt: 'Clean Scheduler payment audits report for check and cash tracking',
    tierBadge: { label: 'Business+', tier: 'business' },
  },
  {
    id: 'sms',
    eyebrow: 'Communication',
    title: 'SMS reminders and review requests on Pro',
    description:
      'Reach customers on the channel they actually read — visit reminders, quote follow-ups, and review nudges via text message.',
    bullets: [
      '25,000 SMS segments per month included',
      'Visit reminders and on-my-way notifications',
      'Review request campaigns alongside email',
    ],
    imageSrc: '/marketing/feature-portals.png',
    imageAlt: 'Clean Scheduler customer communication features',
    tierBadge: { label: 'Pro plan', tier: 'pro' },
  },
];

export const MARKETING_HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Start your free trial',
    description: 'Create your workspace in minutes. No credit card required.',
  },
  {
    step: 2,
    title: 'Add your first quote or customer',
    description:
      'Your dashboard includes a Getting started checklist — follow it to price jobs and build your customer list.',
  },
  {
    step: 3,
    title: 'Schedule jobs and get paid',
    description: 'Connect Stripe when you are ready to accept cards and ACH.',
  },
];

export const MARKETING_THREE_PORTALS = [
  {
    title: 'Team portal',
    description: 'Your office and field staff manage quotes, schedule, billing, and reports.',
    imageSrc: '/marketing/hero-dashboard.png',
    imageAlt: 'Clean Scheduler team dashboard with today’s jobs and key metrics',
  },
  {
    title: 'Customer portal',
    description: 'Clients view appointments, pay invoices, and request reschedules online.',
    imageSrc: '/marketing/feature-customers.png',
    imageAlt: 'Clean Scheduler customer-facing account management',
  },
  {
    title: 'Mobile-friendly field view',
    description: 'Crews check in, complete visits, and record payments from any phone.',
    imageSrc: '/marketing/feature-schedule-mobile.png',
    imageAlt: 'Clean Scheduler mobile schedule for field workers',
    variant: 'mobile' as const,
  },
];

export const MARKETING_FAQ: MarketingFaqItem[] = [
  {
    question: 'Does Clean Scheduler integrate with Stripe?',
    answer:
      'Yes. Stripe Connect lets cleaning companies accept card and ACH payments on invoices. Your Clean Scheduler subscription is billed separately from customer payments. See our Stripe integration page for details.',
  },
  {
    question: 'Do you have commercial cleaning scheduling software?',
    answer:
      'Yes. Clean Scheduler supports multi-site janitorial routes, recurring visit rules per property, crew assignment, and month-end AR reports — built for commercial and residential mixed books.',
  },
  {
    question: 'Do I need a credit card to start the trial?',
    answer:
      'No. Every plan includes a 7-day free trial with no credit card required. You can explore quotes, scheduling, and invoicing before subscribing.',
  },
  {
    question: 'Can I switch plans later?',
    answer:
      'Yes. Upgrade or change plans anytime through Stripe billing. Feature gates in the app match the plan comparison on our pricing page.',
  },
  {
    question: 'What is the difference between platform billing and customer payments?',
    answer:
      'Your Clean Scheduler subscription (Starter, Business, or Pro) is separate from payments you collect from your cleaning clients. Customer invoicing uses your own Stripe Connect account.',
  },
  {
    question: 'How does Zelle tracking work?',
    answer:
      'Clean Scheduler does not connect directly to Zelle. When you link your business bank account, we help match Zelle and ACH deposits to open invoices during reconciliation.',
  },
  {
    question: 'Do you integrate with QuickBooks or payroll systems?',
    answer:
      'Business and Pro plans include payroll export reports with CSV layouts for generic use, ADP, Gusto, and QuickBooks. We do not sync live with accounting software today.',
  },
  {
    question: 'What happens when my trial ends?',
    answer:
      'If you subscribe, your workspace stays active. If not, access pauses until you subscribe. Owners can manage billing or delete the workspace from account settings.',
  },
  {
    question: 'Is Clean Scheduler only for cleaning businesses?',
    answer:
      'Yes. We built the product specifically for residential and commercial cleaning companies — not generic field service.',
  },
  {
    question: 'How is my data protected?',
    answer:
      'We use HTTPS, access controls, and Postgres row-level security. See our Security & Trust page and Privacy Policy for full details.',
  },
];

/** Extended FAQ for /help/faq — includes homepage questions plus help-center-specific answers. */
export const HELP_CENTER_FAQ: MarketingFaqItem[] = [
  ...MARKETING_FAQ,
  {
    question: 'Where can I find guides for cleaning business owners?',
    answer:
      'Visit our Guides for cleaning businesses for walkthroughs on pricing jobs, recurring schedules, getting paid, month-end close, and winning commercial accounts.',
  },
  {
    question: 'How does Clean Scheduler compare to other cleaning software?',
    answer:
      'See our comparison hub for honest reviews against Jobber, ZenMaid, Launch27, Housecall Pro, and Swept — including when a competitor may still be the better fit.',
  },
  {
    question: 'Is there a customer portal for my clients?',
    answer:
      'Yes on Business and Pro plans. Clients can view visits, pay invoices, and request reschedules online. See the customer portal guide for setup steps.',
  },
];

export const MARKETING_SOCIAL_PROOF = {
  headline: 'Built for cleaning teams who need one system — not five',
  highlights: [
    'Quotes → schedule → invoice workflow',
    'Residential & commercial',
    'Month-end close reports',
    'Customer portal on Business+',
  ],
};
