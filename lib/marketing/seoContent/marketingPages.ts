import { COMPETITOR_COMPARE_PAGES } from './competitorComparePages';
import type { SeoMarketingPage } from './types';

export const FOR_PAGES: SeoMarketingPage[] = [
  {
    slug: 'residential-cleaning-companies',
    path: '/for/residential-cleaning-companies',
    metaTitle: 'House cleaning scheduling software for maid services',
    metaDescription:
      'House cleaning scheduling software for residential cleaning companies — recurring home routes, quotes, invoicing, and online payments. Built for maid services and solo cleaners. 7-day free trial.',
    eyebrow: 'Residential cleaning',
    headline: 'House cleaning scheduling software for residential teams',
    lead: 'Run quotes, recurring home visits, crew schedules, and client payments from one workspace — without duct-taping spreadsheets and group texts together.',
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
        title: 'From solo cleaner to multi-crew residential routes',
        paragraphs: [
          'Whether you are a solo owner-operator or run a team of maids, see today’s homes on a calendar built for cleaning ops — assign employees, handle customer reschedule requests, and let field staff check in from their phones.',
        ],
        bullets: [
          'Day, week, and month schedule views',
          'Recurring visit rules for weekly and bi-weekly homes',
          'Customer reschedule inbox with approve/deny',
        ],
        link: {
          href: '/features/scheduling-and-dispatch',
          label: 'House cleaning scheduling software',
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
        question: 'What is the best house cleaning scheduling software?',
        answer:
          'The best fit depends on team size and billing workflow. Clean Scheduler is built for residential cleaning companies that need recurring home schedules, quote-to-invoice workflows, and optional customer portals — not generic field service dispatch. Try the 7-day free trial on your next weekly route.',
      },
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
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning scheduling software' },
      { href: '/features/mobile-scheduling-for-cleaners', label: 'Mobile scheduling for cleaners' },
      { href: '/compare/vs-zenmaid', label: 'vs ZenMaid' },
      { href: '/compare/vs-launch27', label: 'vs Launch27' },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning software' },
      { href: '/compare/spreadsheets-and-texts', label: 'Replace your cleaning spreadsheet' },
      { href: '/pricing', label: 'View pricing' },
    ],
    sitemapPriority: 0.85,
    changeFrequency: 'monthly',
  },
  {
    slug: 'commercial-cleaning-companies',
    path: '/for/commercial-cleaning-companies',
    metaTitle: 'Commercial cleaning scheduling software',
    metaDescription:
      'Commercial cleaning scheduling software for janitorial teams: multi-site crew routes, recurring visit rules, quotes, invoicing, and AR. 7-day free trial.',
    eyebrow: 'Commercial cleaning',
    headline: 'Commercial cleaning scheduling software for janitorial teams',
    lead: 'Schedule crews across multi-site contracts, assign recurring janitorial routes, and keep accounts receivable visible — without losing context across locations or billing contacts. New to commercial sales? Read our guide on how to get commercial cleaning accounts.',
    sections: [
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
          href: '/features/scheduling-and-dispatch',
          label: 'Commercial cleaning scheduling software',
        },
      },
      {
        title: 'Structure complex accounts',
        paragraphs: [
          'Commercial work often means multiple properties under one billing contact. Keep customer records, service locations, and visit history organized so your office team answers questions in seconds — not after searching inboxes.',
        ],
        bullets: [
          'Customer directory with property addresses',
          'Quotes with detailed line items per scope',
          'Visit history and proof-of-service photos on every plan',
        ],
        link: {
          href: '/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts',
          label: 'How to get commercial cleaning accounts',
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
        question: 'What is the best scheduling software for commercial cleaning companies?',
        answer:
          'The best fit depends on your team size and billing workflow. Clean Scheduler is built for janitorial operators who need recurring crew scheduling, multi-property accounts, and bookkeeper-friendly AR — not generic field service dispatch. Try the 7-day free trial on your next commercial route.',
      },
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
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning schedule software' },
      {
        href: '/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts',
        label: 'How to get commercial cleaning accounts',
      },
      { href: '/features/crew-scheduling-and-timekeeping', label: 'Crew scheduling & timekeeping' },
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
    metaTitle: 'Cleaning scheduling software for cleaning businesses',
    metaDescription:
      'Cleaning scheduling software for residential and commercial teams — recurring visit rules, cleaning staff scheduling, crew assignment, and mobile field views. Try free for 7 days.',
    eyebrow: 'Scheduling',
    headline: 'Cleaning scheduling software built for recurring routes',
    lead: 'Plan recurring routes, assign cleaning staff, and handle customer schedule changes — without double-booking your team or rebuilding the calendar every week.',
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
        link: {
          href: '/help/cleaning-businesses/recurring-cleaning-schedule',
          label: 'Set up recurring cleaning schedules',
        },
      },
      {
        title: 'Commercial cleaning routes and multi-site crews',
        paragraphs: [
          'Janitorial contracts need recurring rules across multiple properties under one billing contact. Filter the calendar by employee or customer, assign default crews to contract frequencies, and let field staff check in from mobile-friendly views.',
        ],
        bullets: [
          'Recurring visit rules for weekly and contract frequencies',
          'Property-level detail for commercial accounts',
          'Employee filters on day, week, and month views',
        ],
        link: {
          href: '/for/commercial-cleaning-companies',
          label: 'Commercial cleaning scheduling software',
        },
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
          label: 'Client portal for cleaning companies',
        },
      },
      {
        title: 'Field-friendly mobile workflow',
        paragraphs: [
          'Crews check in, complete visits, capture proof photos, and record on-site payments. Owners see status from the dashboard without calling the team.',
        ],
        bullets: [
          'Visit check-in and completion',
          'Proof-of-service photos',
          'On-site payment recording',
        ],
        link: {
          href: '/features/mobile-scheduling-for-cleaners',
          label: 'Mobile app for cleaning employees',
        },
      },
      {
        title: 'Residential vs commercial scheduling',
        paragraphs: [
          'Residential cleaning companies need recurring home routes and fast quote-to-schedule workflows. Commercial janitorial teams need multi-property accounts under one billing contact. Clean Scheduler supports both in one workspace — with property-level detail for commercial sites and recurring visit rules for residential clients.',
        ],
        bullets: [
          'Residential: weekly and bi-weekly home routes',
          'Commercial: multi-site janitorial contracts',
          'Mixed books with customer tags and property records',
        ],
        link: {
          href: '/help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners',
          label: 'Dispatch software for cleaning companies',
        },
      },
    ],
    faq: [
      {
        question: 'What is the best scheduling software for a cleaning business?',
        answer:
          'The best fit depends on whether you run residential homes, commercial routes, or both. Clean Scheduler is built for recurring cleaning schedules, crew assignment, and customer reschedule handling — not generic HVAC or lawn dispatch. Compare plans and try a 7-day free trial on your actual routes.',
      },
      {
        question: 'What is cleaning schedule software?',
        answer:
          'Cleaning schedule software replaces spreadsheets and group texts with a shared calendar for recurring visits, crew assignment, and schedule changes. Upgrade when multiple people need the same live schedule or when customers expect professional reschedule handling.',
      },
      {
        question:
          'How is cleaning staff scheduling software different from generic employee scheduling?',
        answer:
          'Generic employee scheduling tools focus on shift swaps and hourly retail. Cleaning staff scheduling software ties recurring visit rules to customer properties, quotes, and invoices — so the calendar reflects how cleaning businesses actually sell and bill work.',
      },
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
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning scheduling' },
      { href: '/for/residential-cleaning-companies', label: 'House cleaning scheduling software' },
      {
        href: '/features/crew-scheduling-and-timekeeping',
        label: 'Janitorial scheduling and timekeeping',
      },
      {
        href: '/features/mobile-scheduling-for-cleaners',
        label: 'Mobile app for cleaning employees',
      },
      { href: '/features/invoicing-and-payments', label: 'Online payments for cleaning companies' },
      {
        href: '/help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners',
        label: 'Dispatch software for cleaning companies',
      },
      {
        href: '/help/cleaning-businesses/schedule-cleaning-crews',
        label: 'How to schedule cleaning crews',
      },
      { href: '/start-trial', label: 'Start free trial' },
    ],
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    slug: 'invoicing-and-payments',
    path: '/features/invoicing-and-payments',
    metaTitle: 'Online payments for cleaning companies',
    metaDescription:
      'Online payments for cleaning companies — Stripe card and ACH checkout, invoice pay links, cash and check recording, and Zelle deposit matching. Built for cleaning company AR.',
    eyebrow: 'Payments',
    headline: 'Online payments for cleaning companies',
    lead: 'Send professional invoices, accept online payments when you are ready, and track every payment method your customers actually use — including Zelle and checks.',
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
          href: '/features/stripe-integration',
          label: 'Stripe integration for cleaning companies',
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
      {
        title: 'Credit card processing for cleaning services',
        paragraphs: [
          'Payment processing for cleaning companies often means juggling card checkout, cash, checks, and Zelle screenshots. Stripe Connect adds secure pay links to invoices — customers pay by card or ACH without you managing a separate merchant portal.',
        ],
        bullets: [
          'Credit card and ACH checkout on open invoices',
          'Payment ledger for every customer transaction',
          'Works alongside manual cash, check, and Zelle recording',
        ],
        link: {
          href: '/features/stripe-integration',
          label: 'Cleaning company software with Stripe integration',
        },
      },
    ],
    faq: [
      {
        question: 'What payment solutions work for housekeeping and cleaning companies?',
        answer:
          'Most cleaning companies accept cards via Stripe Connect, record cash and checks in the field, and match Zelle or bank deposits on Business+. Clean Scheduler tracks all payment methods in one ledger — no separate payment app required.',
      },
      {
        question: 'Is there invoice software for cleaning companies?',
        answer:
          'Yes. Clean Scheduler converts completed visits and accepted quotes into professional invoices with email delivery, PDF attachments, and online pay links. Track open balances and month-end AR from your billing hub.',
      },
      {
        question: 'How do cleaning companies accept online payments?',
        answer:
          'Connect Stripe once to add secure pay links to invoices. Customers pay by card or ACH from the invoice email or customer portal. You can also record cash, checks, and Zelle manually — and match bank deposits on Business+.',
      },
      {
        question: 'Does Clean Scheduler integrate with Stripe?',
        answer:
          'Yes. Stripe Connect lets you accept card and ACH payments on invoices. Your Clean Scheduler subscription is billed separately from customer payments collected through your connected Stripe account.',
      },
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
      {
        href: '/features/stripe-integration',
        label: 'Cleaning company software with Stripe integration',
      },
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning scheduling software' },
      {
        href: '/help/cleaning-businesses/customer-portal',
        label: 'Client portal for cleaning companies',
      },
      { href: '/help/cleaning-businesses/get-paid-zelle-and-cards', label: 'Get paid guide' },
      { href: '/pricing', label: 'View pricing' },
    ],
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    slug: 'stripe-integration',
    path: '/features/stripe-integration',
    metaTitle: 'Cleaning company software with Stripe integration',
    metaDescription:
      'Cleaning company software with Stripe integration — accept card and ACH on invoices via Stripe Connect. Separate from platform billing. 7-day free trial, no credit card required.',
    eyebrow: 'Stripe integration',
    headline: 'Cleaning company software with Stripe integration',
    lead: 'Accept card and ACH payments on cleaning invoices through Stripe Connect — funds settle to your connected account, separate from your Clean Scheduler subscription.',
    sections: [
      {
        title: 'Two different Stripe relationships',
        paragraphs: [
          'Clean Scheduler uses Stripe in two ways that are easy to confuse. Your platform subscription (Starter, Business, or Pro) is billed to your business through Stripe. Customer payments — cards and ACH on cleaning invoices — flow through your own Stripe Connect account and settle to you directly.',
        ],
        bullets: [
          'Platform billing: your Clean Scheduler plan fee',
          'Stripe Connect: payments from your cleaning clients',
          'Separate ledgers — no commingling of subscription and client revenue',
        ],
      },
      {
        title: 'Stripe Connect onboarding in the app',
        paragraphs: [
          'From Billing → Accept card payments, complete a one-time Stripe Connect onboarding. Once approved, open invoices can include secure pay links your customers use to pay by card or bank transfer.',
        ],
        bullets: [
          'Guided Connect onboarding inside Clean Scheduler',
          'Pay links on emailed invoices and customer portal',
          'Payment ledger for every customer transaction',
        ],
        link: {
          href: '/help/cleaning-businesses/get-paid-zelle-and-cards',
          label: 'Get paid with cards, Zelle, and checks',
        },
      },
      {
        title: 'Optional — not required to run your business',
        paragraphs: [
          'Many cleaning companies start by recording cash, check, and Zelle payments manually. Enable Stripe when you are ready for card acceptance. On Business+, bank deposit matching helps reconcile Zelle and ACH even when cards are not turned on.',
        ],
        bullets: [
          'Manual payment recording without Stripe',
          'Customer portals can show invoices before Connect is live',
          'Bank deposit matching for Zelle on Business+',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
      {
        title: 'Payment processing for cleaning companies',
        paragraphs: [
          'Credit card processing for cleaning services does not require a separate merchant portal. Stripe Connect adds secure pay links to your invoices — customers pay by card or ACH from the email or customer portal. Funds settle to your connected account, separate from your Clean Scheduler subscription.',
        ],
        bullets: [
          'Credit card and ACH checkout on open invoices',
          'Payment ledger for every customer transaction',
          'Works alongside cash, check, and Zelle workflows',
        ],
        link: {
          href: '/features/invoicing-and-payments',
          label: 'Online payments for cleaning companies',
        },
      },
      {
        title: 'Stripe Connect vs manual payments vs Zelle matching',
        paragraphs: [
          'Most cleaning companies use a mix of payment methods. Stripe Connect handles online card and ACH checkout on invoices. Manual recording covers cash and checks collected in the field. Bank deposit matching on Business+ ties Zelle and ACH transfers to open invoices after funds land — no direct Zelle integration required.',
        ],
        bullets: [
          'Stripe Connect: online invoice pay links',
          'Manual: cash, check, and offline collections',
          'Deposit matching: reconcile Zelle and bank transfers',
        ],
        link: {
          href: '/help/cleaning-businesses/get-paid-zelle-and-cards',
          label: 'Get paid with cards, Zelle, and checks',
        },
      },
    ],
    faq: [
      {
        question: 'Does Clean Scheduler have Stripe integration for cleaning companies?',
        answer:
          'Yes. Stripe Connect lets you accept card and ACH payments on cleaning invoices. Your Clean Scheduler subscription is billed separately from customer payments collected through your connected Stripe account.',
      },
      {
        question: 'Can cleaning companies accept credit cards with Clean Scheduler?',
        answer:
          'Yes. After a one-time Stripe Connect onboarding, open invoices include secure pay links customers use to pay by card or bank transfer from the invoice email or customer portal.',
      },
      {
        question: 'Is Stripe required to use Clean Scheduler?',
        answer:
          'No. Quotes, scheduling, invoicing, and manual payment recording work without Stripe. Connect is only needed when you want card or ACH checkout links on invoices.',
      },
      {
        question: 'How is platform billing different from customer payments?',
        answer:
          'Your Clean Scheduler subscription is a separate Stripe charge from payments your clients make through your connected account. Client funds settle to your bank via Stripe Connect.',
      },
      {
        question: 'Does Clean Scheduler support ACH through Stripe?',
        answer:
          'Yes. When Stripe Connect is enabled, customers can pay open invoices via card or ACH depending on your Connect configuration and the checkout options enabled on the invoice.',
      },
    ],
    relatedLinks: [
      {
        href: '/features/invoicing-and-payments',
        label: 'Online payments for cleaning companies',
      },
      {
        href: '/help/cleaning-businesses/get-paid-zelle-and-cards',
        label: 'Payment processing for cleaning companies',
      },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning software' },
      { href: '/pricing', label: 'View pricing' },
    ],
    ctaTitle: 'Try Stripe integration on your next invoice',
    ctaLead:
      'Start a 7-day free trial, send a quote, and connect Stripe when you are ready to accept cards.',
    sitemapPriority: 0.82,
    changeFrequency: 'monthly',
  },
  {
    slug: 'crew-scheduling-and-timekeeping',
    path: '/features/crew-scheduling-and-timekeeping',
    metaTitle: 'Janitorial scheduling and timekeeping for cleaning companies',
    metaDescription:
      'Employee scheduling software for cleaning companies — assign crews to recurring routes, visit check-in, and payroll export from completed visits. Not a full HR timeclock.',
    eyebrow: 'Crew scheduling',
    headline: 'Janitorial scheduling and timekeeping for cleaning crews',
    lead: 'Assign cleaning staff to recurring routes, track visit completion in the field, and export payroll from completed work — without a separate timeclock app or generic employee scheduling tool.',
    sections: [
      {
        title: 'Employee scheduling software built for cleaning routes',
        paragraphs: [
          'Generic employee scheduling tools focus on shift swaps at retail stores. Cleaning companies need recurring visit rules tied to customer properties — weekly homes, bi-weekly routes, and commercial contract frequencies. Clean Scheduler assigns default crews to each rule so the calendar reflects how you actually run jobs.',
        ],
        bullets: [
          'Recurring visit rules with default assignees',
          'Day, week, and month views filtered by employee',
          'One-time visits and recurring rules on the same calendar',
        ],
        link: {
          href: '/features/scheduling-and-dispatch',
          label: 'Cleaning scheduling software',
        },
      },
      {
        title: 'Visit check-in as lightweight timekeeping',
        paragraphs: [
          'Field employees check in and complete visits from mobile-friendly views. That gives your office a record of who was on site and when work finished. Check-in can also capture GPS location proof — without a separate timeclock app or continuous GPS tracking.',
        ],
        bullets: [
          'Visit check-in and completion workflow',
          'Field schedule view for cleaners',
          'GPS-verified check-in and proof-of-service photos on every plan',
        ],
        link: {
          href: '/features/mobile-scheduling-for-cleaners',
          label: 'Mobile scheduling for cleaners',
        },
      },
      {
        title: 'Payroll export from completed visits',
        paragraphs: [
          'On Business and Pro plans, payroll exports use completed visit data and compensation rules configured in settings. Export CSV layouts for generic use, ADP, Gusto, or QuickBooks — then import into your payroll provider.',
        ],
        bullets: [
          'Payroll export on Business+',
          'Completed visits as the source of truth',
          'Month-end close checklist includes payroll step',
        ],
        link: {
          href: '/help/cleaning-businesses/month-end-close',
          label: 'Month-end close guide',
        },
      },
      {
        title: 'What Clean Scheduler is not',
        paragraphs: [
          'We are not a full HR or timeclock platform. Every plan includes GPS-verified visit check-in for arrival proof. If you need continuous geofencing, break tracking, or PTO management, pair Clean Scheduler with a dedicated timekeeping tool. Our focus is cleaning-specific scheduling, visit completion, and payroll-ready exports for operators who outgrew spreadsheets.',
        ],
      },
    ],
    faq: [
      {
        question: 'What is the best employee scheduling software for cleaning companies?',
        answer:
          'The best fit depends on whether you run recurring residential routes, commercial janitorial contracts, or both. Clean Scheduler is built for cleaning-specific crew assignment, visit completion, and payroll export — not generic retail shift scheduling.',
      },
      {
        question: 'Is Clean Scheduler employee scheduling software for cleaning companies?',
        answer:
          'Yes — for recurring cleaning routes, crew assignment, and visit completion. It is not a generic shift-scheduling tool for hourly retail or restaurant staff.',
      },
      {
        question: 'Does Clean Scheduler replace a timeclock app?',
        answer:
          'Partially. Visit check-in and completion track field work tied to customer jobs, and every plan can capture GPS location proof at check-in. For full timeclock features (breaks, continuous geofencing, PTO), use a dedicated HR tool alongside Clean Scheduler.',
      },
      {
        question: 'Can I export payroll hours from Clean Scheduler?',
        answer:
          'Business and Pro plans include payroll export reports based on completed visits and your compensation settings. Export CSV for ADP, Gusto, QuickBooks, or generic import.',
      },
    ],
    relatedLinks: [
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning staff scheduling software' },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial janitorial scheduling' },
      {
        href: '/help/cleaning-businesses/schedule-cleaning-crews',
        label: 'Cleaning crew management guide',
      },
      {
        href: '/help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners',
        label: 'Dispatch software for cleaning companies',
      },
      { href: '/features/invoicing-and-payments', label: 'Online payments for cleaning companies' },
      { href: '/start-trial', label: 'Start free trial' },
    ],
    sitemapPriority: 0.78,
    changeFrequency: 'monthly',
  },
  {
    slug: 'mobile-scheduling-for-cleaners',
    path: '/features/mobile-scheduling-for-cleaners',
    metaTitle: 'Mobile app for cleaning employees',
    metaDescription:
      'A mobile app for cleaning employees — mobile day views, visit check-in, on-site payment recording, and proof photos. No App Store download required; runs in the mobile browser.',
    eyebrow: 'Mobile app',
    headline: 'Mobile app for cleaning employees',
    lead: 'Give your cleaning crew a mobile-friendly schedule view — check in on site, complete visits, record payments, and capture proof photos without calling the office. No separate App Store download required.',
    sections: [
      {
        title: 'Today’s route on any phone',
        paragraphs: [
          'Field employees sign in to see their assigned visits for the day — addresses, customer notes, and visit status. No separate cleaner app download required; the schedule works in the mobile browser.',
        ],
        bullets: [
          'Mobile-friendly day schedule for field staff',
          'Visit details and property addresses',
          'Simplified view — no full office dashboard',
        ],
        link: {
          href: '/features/scheduling-and-dispatch',
          label: 'Cleaning scheduling software',
        },
      },
      {
        title: 'Check in and complete visits on site',
        paragraphs: [
          'Cleaners mark visits in progress and complete them from the field. Owners and office managers see status updates on the dashboard without a group text chain.',
        ],
        bullets: [
          'Visit check-in and completion',
          'Audit trail for schedule changes',
          'Works for residential and commercial routes',
        ],
      },
      {
        title: 'Record payments and proof in the field',
        paragraphs: [
          'When customers pay cash or check on site, field staff record the payment during visit completion. Capture proof-of-service photos for commercial accounts or quality assurance on every plan.',
        ],
        bullets: [
          'On-site manual payment recording',
          'Proof-of-service photos',
          'Payment audits for month-end close',
        ],
        link: {
          href: '/features/invoicing-and-payments',
          label: 'Online payments for cleaning companies',
        },
      },
    ],
    faq: [
      {
        question: 'Is there a mobile app for cleaning employees to download?',
        answer:
          'Clean Scheduler runs in the mobile browser — field employees sign in and see their schedule without a separate App Store download. This keeps onboarding simple for cleaners who rotate frequently.',
      },
      {
        question: 'What is cleaning crew mobile software?',
        answer:
          'Cleaning crew mobile software lets field employees see today’s route, check in on site, complete visits, and record on-site payments. Clean Scheduler includes this in the mobile browser — no separate cleaner app install required.',
      },
      {
        question: 'Can cleaners see the full company calendar?',
        answer:
          'No. Field employees see their assigned visits. Office seats (owner, admin, viewer) manage the full calendar and customer records.',
      },
      {
        question: 'How does this compare to competitor cleaner apps?',
        answer:
          'Many maid-service tools offer a dedicated cleaner app with live GPS. Clean Scheduler focuses on scheduling, visit completion, GPS check-in proof on every plan, and payments tied to your quotes and invoices — see our comparison hub for details on ZenMaid, Launch27, and others.',
      },
    ],
    relatedLinks: [
      { href: '/for/residential-cleaning-companies', label: 'House cleaning scheduling software' },
      {
        href: '/features/crew-scheduling-and-timekeeping',
        label: 'Cleaning crew management software',
      },
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning scheduling software' },
      { href: '/compare', label: 'Compare cleaning software' },
      { href: '/start-trial', label: 'Start free trial' },
    ],
    sitemapPriority: 0.78,
    changeFrequency: 'monthly',
  },
];

export const COMPARE_PAGES: SeoMarketingPage[] = [
  {
    slug: 'spreadsheets-and-texts',
    path: '/compare/spreadsheets-and-texts',
    metaTitle: 'Replace your cleaning spreadsheet with scheduling software',
    metaDescription:
      'Replace cleaning spreadsheet software with quotes, scheduling, and invoicing in one system. Compare spreadsheets and group texts vs Clean Scheduler for cleaning businesses.',
    eyebrow: 'Compare',
    headline: 'Replace your cleaning spreadsheet before it breaks your schedule',
    lead: 'Many cleaning companies start with free tools. Here is an honest look at when to replace your cleaning spreadsheet — and what changes when you switch to dedicated scheduling software.',
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
        title: 'Replace cleaning spreadsheet software in 3 weeks',
        paragraphs: [
          'You do not need to move every client on day one. Most owners import active customers, schedule the next two weeks of work, and send new invoices from Clean Scheduler while finishing open AR from the old system.',
        ],
        bullets: [
          'Week 1: import active customers and upcoming visits',
          'Week 2: send new quotes and invoices from Clean Scheduler',
          'Week 3+: retire the spreadsheet for scheduling',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
    ],
    faq: [
      {
        question: 'What replaces cleaning spreadsheet software?',
        answer:
          'Dedicated cleaning scheduling software like Clean Scheduler replaces spreadsheets with quotes, recurring visit rules, crew assignment, invoicing, and payment tracking in one workspace. Most owners migrate active customers first and retire the spreadsheet within a few weeks.',
      },
      {
        question: 'When should I replace my cleaning spreadsheet?',
        answer:
          'Upgrade when multiple people need the same live schedule, customers expect professional invoices, or month-end AR takes hours reconciling texts and payment screenshots. Solo operators with a handful of weekly clients can often wait.',
      },
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
      { href: '/features/scheduling-and-dispatch', label: 'Cleaning scheduling software' },
      {
        href: '/features/stripe-integration',
        label: 'Cleaning company software with Stripe integration',
      },
      { href: '/compare/vs-jobber', label: 'vs Jobber' },
      { href: '/compare/vs-zenmaid', label: 'vs ZenMaid' },
      {
        href: '/compare/vs-generic-field-service-software',
        label: 'vs generic field service tools',
      },
      { href: '/why-cleanscheduler', label: 'Why Clean Scheduler' },
      { href: '/pricing', label: 'Pricing' },
    ],
    ctaTitle: 'Stop managing cleans in spreadsheets',
    ctaLead:
      'Start a 7-day free trial — no credit card required — and run your next quote, visit, and invoice without rebuilding the week in a spreadsheet.',
    sitemapPriority: 0.8,
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
