import type { SeoMarketingPage } from './types';

const PRICING_VERIFIED = 'June 2026';

export const COMPETITOR_COMPARE_PAGES: SeoMarketingPage[] = [
  {
    slug: 'vs-jobber',
    path: '/compare/vs-jobber',
    metaTitle: 'Clean Scheduler vs Jobber for cleaning businesses',
    metaDescription:
      'Compare Clean Scheduler and Jobber for residential and commercial cleaning companies. Features, pricing, pros and cons, and when each platform fits best. 7-day free trial.',
    eyebrow: 'Compare',
    headline: 'Clean Scheduler vs Jobber',
    lead: 'Jobber is one of the most popular field service platforms — and many cleaning companies start there. Here is an honest comparison of where Jobber excels and where Clean Scheduler is built differently for cleaning ops, AR, and month-end close.',
    comparisonTable: {
      competitorName: 'Jobber',
      lastVerified: PRICING_VERIFIED,
      rows: [
        {
          feature: 'Built for',
          cleanScheduler: 'Residential & commercial cleaning',
          competitor: '50+ field service industries',
        },
        {
          feature: 'Starting price',
          cleanScheduler: '$39/mo (Starter)',
          competitor: '$39/mo (Core, 1 user)',
        },
        {
          feature: 'Team pricing model',
          cleanScheduler: 'Office + field seat bundles',
          competitor: 'Per-user tiers; extra users ~$29/mo each',
        },
        {
          feature: 'Quote pipeline',
          cleanScheduler: 'Line-item quotes → accepted job → first visit',
          competitor: 'Quotes & estimates (tier-dependent)',
        },
        {
          feature: 'Recurring scheduling',
          cleanScheduler: 'Recurring visit rules separate from billing',
          competitor: 'Recurring jobs & contracts',
        },
        {
          feature: 'Customer portal',
          cleanScheduler: 'Business+ (reschedule, pay invoices)',
          competitor: 'Client Hub on Connect+',
        },
        {
          feature: 'Card payments',
          cleanScheduler: 'Stripe Connect on your account',
          competitor: 'Jobber Payments / Stripe',
        },
        {
          feature: 'Zelle / bank deposit matching',
          cleanScheduler: 'Plaid reconciliation on Business+',
          competitor: 'Not built in',
        },
        {
          feature: 'Payroll export',
          cleanScheduler: 'ADP, Gusto, QuickBooks layouts (Business+)',
          competitor: 'Timesheets; QuickBooks sync on higher tiers',
        },
        {
          feature: 'GPS / route optimization',
          cleanScheduler: 'GPS check-in proof (all plans); no live fleet / routes',
          competitor: 'GPS tracking on Grow+',
        },
        {
          feature: 'Free trial',
          cleanScheduler: '7 days, no credit card',
          competitor: '14 days (card may be required)',
        },
      ],
    },
    sections: [
      {
        title: 'The short answer',
        paragraphs: [
          'Choose Jobber if you want a mature, general-purpose field service platform with strong mobile apps, GPS tracking, and automations — and you are fine paying more as you add users and upgrade tiers.',
          'Choose Clean Scheduler if you run a cleaning business that needs quote-to-invoice workflows, mixed residential and commercial books, and bookkeeper-friendly AR — including matching Zelle and bank deposits to open invoices.',
        ],
      },
      {
        title: 'Where Jobber wins',
        bullets: [
          'Brand recognition and a large user community across many trades',
          'Polished mobile apps for crews with GPS tracking and route tools on higher tiers',
          'Mature automations: appointment reminders, quote follow-ups, invoice nudges',
          'QuickBooks Online sync on Connect and above',
          'Online booking and a client hub for self-service on mid-tier plans',
          'Broad integrations ecosystem beyond cleaning-specific tools',
        ],
      },
      {
        title: 'Where Clean Scheduler wins',
        bullets: [
          'Purpose-built for residential and commercial cleaning — not 50 industries',
          'Quote pipeline with line items designed for cleaning scopes and add-ons',
          'Recurring visit rules kept separate from billing recurrence',
          'Bank deposit reconciliation to match Zelle, ACH, and wire payments (Business+)',
          'Month-end close workflow: collections, payment audits, sales tax summary',
          'Payroll export layouts for common providers without treating every job as a dispatch ticket',
          '7-day free trial with no credit card required',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
      {
        title: 'Pricing reality check',
        paragraphs: [
          `Pricing last verified ${PRICING_VERIFIED}. Jobber publishes tiered plans: Core from about $39/mo for one user, Connect from about $119/mo for up to five users, Grow from about $199/mo, and Plus at about $599/mo. Additional users and annual vs monthly billing change the total quickly.`,
          'Clean Scheduler Starter is $39/mo with one office seat and three field seats. Business is $129/mo with two office seats, ten field seats, customer portal, payroll export, and bank reconciliation. Pro is $299/mo with advanced analytics, SMS, and white-label portal.',
          'For a five-person cleaning team, Jobber Connect or Grow is often $119–$249/mo before payment processing fees. Clean Scheduler Business at $129/mo includes more field seats and bookkeeper-focused reports — compare the feature matrix on our pricing page before deciding.',
        ],
        link: { href: '/pricing', label: 'View Clean Scheduler pricing' },
      },
      {
        title: 'Switching from Jobber',
        paragraphs: [
          'Most owners migrate active customers first, import the next two weeks of visits, and run new quotes and invoices from Clean Scheduler while finishing open AR in Jobber. You do not need a big-bang cutover on day one.',
          'If your bookkeeper spends hours matching Zelle screenshots to invoices, bank deposit matching alone can justify a parallel trial.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is Clean Scheduler cheaper than Jobber?',
        answer:
          'It depends on team size and which features you need. Solo operators may pay similar entry prices. Growing teams often find Clean Scheduler Business competitive because field seats are bundled rather than priced per user like Jobber’s higher tiers.',
      },
      {
        question: 'Does Clean Scheduler have GPS tracking like Jobber?',
        answer:
          'Clean Scheduler captures GPS location proof at visit check-in on every plan so the office can verify arrival. We do not offer live fleet tracking or route optimization — Jobber’s Grow tier may still be a better fit if those are must-haves.',
      },
      {
        question: 'Can Clean Scheduler handle commercial cleaning accounts?',
        answer:
          'Yes. One workspace supports mixed residential and commercial books with property-level detail, multi-site customers, and month-end AR reports built for operators who invoice on net terms.',
      },
      {
        question: 'Do I need a credit card to try Clean Scheduler?',
        answer:
          'No. The 7-day trial includes core quote, schedule, and invoice workflows without entering a card.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-housecall-pro', label: 'vs Housecall Pro' },
      { href: '/compare/vs-zenmaid', label: 'vs ZenMaid' },
      { href: '/compare/vs-launch27', label: 'vs Launch27' },
      {
        href: '/compare/vs-generic-field-service-software',
        label: 'vs generic field service tools',
      },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning software' },
      { href: '/pricing', label: 'Pricing' },
    ],
    ctaTitle: 'See how Clean Scheduler fits your cleaning business',
    ctaLead:
      'Run your next quote, recurring visit, and invoice in a 7-day free trial — built for cleaning ops, not every trade under the sun.',
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    slug: 'vs-zenmaid',
    path: '/compare/vs-zenmaid',
    metaTitle: 'Clean Scheduler vs ZenMaid for maid services',
    metaDescription:
      'Clean Scheduler vs ZenMaid for residential cleaning and maid services. Compare scheduling, pricing, invoicing, commercial support, and bookkeeper tools. Free trial.',
    eyebrow: 'Compare',
    headline: 'Clean Scheduler vs ZenMaid',
    lead: 'ZenMaid is one of the best-known platforms built exclusively for residential maid services. Clean Scheduler covers residential work too — but also commercial accounts and deeper AR. Here is when each makes sense.',
    comparisonTable: {
      competitorName: 'ZenMaid',
      lastVerified: PRICING_VERIFIED,
      rows: [
        {
          feature: 'Primary focus',
          cleanScheduler: 'Residential & commercial cleaning',
          competitor: 'Residential maid / house cleaning',
        },
        {
          feature: 'Starting price',
          cleanScheduler: '$39/mo (Starter)',
          competitor: '$19/mo base + $4/seat (40 appts/mo cap)',
        },
        {
          feature: 'Mid-tier example (5 cleaners)',
          cleanScheduler: '$129/mo Business (10 field seats)',
          competitor: '~$109/mo Pro ($39 + 5 × $14/seats)',
        },
        {
          feature: 'Online booking widget',
          cleanScheduler: 'Public quote request form (all plans); portal Business+',
          competitor: 'High-converting booking forms (Pro+)',
        },
        {
          feature: 'Quote pipeline',
          cleanScheduler: 'Full quote stages with line items',
          competitor: 'Booking-first; limited formal quoting',
        },
        {
          feature: 'Recurring schedule tools',
          cleanScheduler: 'Recurring visit rules + billing plans',
          competitor: 'Spotfinder + recurring templates',
        },
        {
          feature: 'Cleaner checklists / GPS',
          cleanScheduler: 'GPS check-in + proof photos (all plans)',
          competitor: 'Digital checklists + GPS (Pro+)',
        },
        {
          feature: 'Commercial / janitorial',
          cleanScheduler: 'Multi-property accounts, contract AR',
          competitor: 'Not a core strength',
        },
        {
          feature: 'Bank / Zelle deposit matching',
          cleanScheduler: 'Plaid reconciliation (Business+)',
          competitor: 'Stripe/Square payments; no deposit matching',
        },
        {
          feature: 'Payroll export',
          cleanScheduler: 'ADP, Gusto, QuickBooks (Business+)',
          competitor: 'Payroll on Pro+',
        },
        {
          feature: 'Free trial',
          cleanScheduler: '7 days, no credit card',
          competitor: '14 days',
        },
      ],
    },
    sections: [
      {
        title: 'The short answer',
        paragraphs: [
          'Choose ZenMaid if you run a residential maid service and want a cleaning-native tool with Spotfinder scheduling, maid-specific booking forms, and a simple cleaner mobile app — especially at smaller team sizes.',
          'Choose Clean Scheduler if you also serve commercial accounts, need a formal quote pipeline before scheduling, or want bookkeeper-grade AR with bank deposit matching and month-end close reports.',
        ],
      },
      {
        title: 'Where ZenMaid wins',
        bullets: [
          'Built by maid service operators — workflows feel native to residential cleaning',
          'Spotfinder helps slot new recurring clients into gaps in existing routes',
          'Booking forms ask cleaning-specific questions (bedrooms, pets, frequency) out of the box',
          'Digital checklists and GPS tracking on Pro plans',
          'Lower base price on Starter for very small teams (with a 40-appointment monthly cap)',
          'Cleaner SOS safety alert — a thoughtful residential-only touch',
          'Automated SMS and email templates tuned for maid service communication',
        ],
      },
      {
        title: 'Where Clean Scheduler wins',
        bullets: [
          'Commercial and janitorial accounts alongside residential homes in one workspace',
          'Quote pipeline: draft → send → accept → schedule first visit with line items',
          'Customer portal for reschedule requests, invoice payment, and visit history (Business+)',
          'Bank deposit reconciliation for Zelle and ACH — not just card processing',
          'Collections reports, payment audits, and sales tax summary for month-end close',
          'No per-seat math on Starter — three field seats included at $39/mo',
          'Scales to 5,000+ active customers on Business without appointment caps',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
      {
        title: 'Pricing reality check',
        paragraphs: [
          `Pricing last verified ${PRICING_VERIFIED}. ZenMaid uses a base fee plus per-seat model: Starter $19/mo + $4/seat (capped at 40 appointments/month), Pro $39/mo + $14/seat, Pro Max $49/mo + $24/seat. SMS messaging is extra on all plans.`,
          'A five-cleaner team on ZenMaid Pro pays about $39 + (5 × $14) = $109/mo before SMS and processing fees. Clean Scheduler Business is $129/mo with two office seats, ten field seats, customer portal, payroll export, and bank reconciliation included.',
          'ZenMaid Starter looks inexpensive until you outgrow the appointment cap or need checklists and booking forms — then Pro seat fees add up similarly to other platforms. Clean Scheduler includes GPS check-in proof on every plan.',
        ],
        link: { href: '/pricing', label: 'View Clean Scheduler pricing' },
      },
      {
        title: 'Switching from ZenMaid',
        paragraphs: [
          'Export your customer list from ZenMaid (Pro Max includes data export), import active clients into Clean Scheduler, and schedule the next two weeks of visits. Keep accepting payments through Stripe while you enable bank matching for Zelle-heavy clients.',
          'If you are adding commercial contracts, Clean Scheduler’s property-level customer records and collections reports save hours compared to stretching a residential-first tool.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is ZenMaid better for solo residential cleaners?',
        answer:
          'Often yes, especially if you live in online booking and automated maid-specific texts. ZenMaid Starter can cost less than Clean Scheduler when you are under the 40-appointment cap and do not need commercial features.',
      },
      {
        question: 'Does Clean Scheduler have Spotfinder-style scheduling?',
        answer:
          'Not as a branded feature. Clean Scheduler focuses on recurring visit rules and calendar views with employee filters. If Spotfinder-style gap filling is central to how you sell recurring homes, trial ZenMaid alongside Clean Scheduler.',
      },
      {
        question: 'Can I run both residential and commercial in Clean Scheduler?',
        answer:
          'Yes. Mixed books are a first-class use case — use customer tags and property records to keep account types clear in reports.',
      },
      {
        question: 'Which has better bookkeeper tools?',
        answer:
          'Clean Scheduler is stronger for month-end close: outstanding invoice reports, payment audits, Plaid deposit matching, sales tax summary, and payroll exports. ZenMaid covers payroll on Pro but is lighter on commercial AR workflows.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-jobber', label: 'vs Jobber' },
      { href: '/compare/vs-launch27', label: 'vs Launch27' },
      { href: '/for/residential-cleaning-companies', label: 'Residential cleaning software' },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning software' },
      { href: '/pricing', label: 'Pricing' },
    ],
    ctaTitle: 'Try Clean Scheduler on your next residential or commercial account',
    ctaLead:
      'Start a 7-day free trial and run a quote, recurring schedule, and invoice — no credit card required.',
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    slug: 'vs-launch27',
    path: '/compare/vs-launch27',
    metaTitle: 'Launch27 alternative for cleaning companies',
    metaDescription:
      'Looking for a Launch27 alternative? Compare Clean Scheduler vs Launch27 for maid services — online booking, pricing, team management, invoicing, and when to switch. 7-day free trial.',
    eyebrow: 'Compare',
    headline: 'Clean Scheduler — a Launch27 alternative for growing cleaning companies',
    lead: 'Looking for a Launch27 alternative? Launch27 is a veteran maid-service platform known for website booking forms and automated client communication. Clean Scheduler takes a broader ops-and-finance angle. Here is an honest comparison for growing cleaning companies.',
    comparisonTable: {
      competitorName: 'Launch27',
      lastVerified: PRICING_VERIFIED,
      rows: [
        {
          feature: 'Primary focus',
          cleanScheduler: 'Full ops: quotes, schedule, AR, month-end',
          competitor: 'Online booking & maid service automation',
        },
        {
          feature: 'Starting price',
          cleanScheduler: '$39/mo (Starter)',
          competitor: '$75/mo (Base)',
        },
        {
          feature: 'Users included',
          cleanScheduler: 'Seat bundles by tier',
          competitor: 'Unlimited users on all plans',
        },
        {
          feature: 'Website booking form',
          cleanScheduler: 'Public /book quote request (all plans)',
          competitor: 'Core product — bedroom/bath/sqft pricing',
        },
        {
          feature: 'Card pre-auth & auto-charge',
          cleanScheduler: 'Stripe Connect pay links',
          competitor: 'Pre-auth & auto-charge (Scale $299)',
        },
        {
          feature: 'Cleaner mobile app',
          cleanScheduler: 'Field schedule & check-in',
          competitor: 'Mobile app on Scale plan ($299/mo)',
        },
        {
          feature: 'Gift cards & referrals',
          cleanScheduler: 'Promotions & referral program (Business+)',
          competitor: 'Gift card engine (Pro+); referral engine (Scale)',
        },
        {
          feature: 'Commercial cleaning',
          cleanScheduler: 'Multi-site accounts & contract AR',
          competitor: 'Residential maid service focus',
        },
        {
          feature: 'Quote pipeline',
          cleanScheduler: 'Line-item quotes with pipeline stages',
          competitor: 'Instant online estimates via booking form',
        },
        {
          feature: 'Bank / Zelle deposit matching',
          cleanScheduler: 'Plaid reconciliation (Business+)',
          competitor: 'Card-focused; no deposit matching',
        },
        {
          feature: 'Free trial',
          cleanScheduler: '7 days, no credit card',
          competitor: '14 days',
        },
      ],
    },
    sections: [
      {
        title: 'The short answer',
        paragraphs: [
          'Choose Launch27 if your growth strategy centers on a high-converting website booking form, automated reminders, and card-on-file charging — and you are primarily a residential maid service willing to start at $75/mo.',
          'Choose Clean Scheduler if you need lower entry pricing, formal quotes for commercial scopes, bookkeeper-friendly AR, and a single console from first quote through month-end close.',
        ],
      },
      {
        title: 'Where Launch27 wins',
        bullets: [
          'Best-in-class embeddable booking forms with bedroom/bathroom/sqft pricing models',
          'Unlimited users and bookings on every plan — no per-seat surprises',
          'Automated email and SMS reminders to cut no-shows',
          'Card pre-authorization and automatic charging on the Scale tier',
          'Gift card engine, referral program, and review-request automations on higher tiers',
          'Post-job client feedback and employee rating trackers',
          'Built by a maid service operator — strong residential booking UX',
        ],
      },
      {
        title: 'Where Clean Scheduler wins',
        bullets: [
          'Starts at $39/mo — less than half Launch27 Base ($75/mo)',
          'Quote pipeline for jobs that need office review before scheduling',
          'Commercial and janitorial accounts with property-level billing contacts',
          'Invoicing with manual payment recording for cash, check, and Zelle',
          'Bank deposit matching when clients pay outside card rails (Business+)',
          'Payroll export, payment audits, and sales tax summary for bookkeepers',
          'Mobile field workflow included without a $299/mo Scale plan',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
      {
        title: 'Pricing reality check',
        paragraphs: [
          `Pricing last verified ${PRICING_VERIFIED}. Launch27 tiers: Base $75/mo, Pro $150/mo, Scale $299/mo (15% off annual). Unlimited users on all plans. Text reminders, premium booking forms, and QuickBooks sync require Pro. Mobile apps and auto-charging require Scale.`,
          'Clean Scheduler Starter is $39/mo; Business is $129/mo with customer portal, proof photos, payroll export, and bank reconciliation; Pro is $299/mo with SMS, white-label portal, and advanced analytics.',
          'Launch27 and Clean Scheduler Pro are similarly priced at ~$299/mo — but they solve different problems. Launch27 Scale optimizes for booking automation and card-on-file. Clean Scheduler Pro optimizes for analytics, SMS campaigns, and white-label customer portals across mixed residential and commercial books.',
        ],
        link: { href: '/pricing', label: 'View Clean Scheduler pricing' },
      },
      {
        title: 'Who should switch from Launch27',
        paragraphs: [
          'Import your client list, recreate active recurring rules in Clean Scheduler, and send the next invoice cycle from the new system. If you rely heavily on an embedded booking form, plan a transition period where the form still points to Launch27 until you replicate quoting workflows in Clean Scheduler.',
          'Teams with bookkeepers drowning in Zelle payment screenshots often see immediate ROI from deposit matching — something Launch27 does not offer natively.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is Clean Scheduler a good Launch27 alternative?',
        answer:
          'Yes, if you need lower entry pricing, formal quotes for commercial scopes, bookkeeper-friendly AR, and month-end close reports. Launch27 remains the better fit when your growth strategy centers on embeddable website booking forms and card-on-file automation for residential maid services.',
      },
      {
        question: 'Does Clean Scheduler have a website booking widget like Launch27?',
        answer:
          'Every plan includes a public quote / booking request form on your workspace subdomain (`/book`). It captures leads for your office — it is not an embeddable bedroom/bath pricing calculator or instant self-booking like Launch27. If that widget is your primary sales channel, Launch27 Base may still be a better fit.',
      },
      {
        question: 'Is Launch27 cheaper for larger teams?',
        answer:
          'Often yes — unlimited users on all Launch27 plans avoids per-seat fees. Clean Scheduler bundles office and field seats by tier, which is competitive for small-to-mid teams but may differ at very large crew counts.',
      },
      {
        question: 'Which is better for commercial janitorial work?',
        answer:
          'Clean Scheduler. Launch27 is optimized for residential maid booking flows. Commercial operators need multi-property accounts, net-term invoicing, and month-end AR reports.',
      },
      {
        question: 'Can I try Clean Scheduler before canceling Launch27?',
        answer:
          'Yes. Run a parallel 7-day trial with a subset of customers. No credit card is required, so you can evaluate bookkeeper workflows without committing.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-zenmaid', label: 'vs ZenMaid' },
      { href: '/compare/vs-jobber', label: 'vs Jobber' },
      { href: '/for/residential-cleaning-companies', label: 'Residential cleaning software' },
      { href: '/compare/spreadsheets-and-texts', label: 'Replace cleaning spreadsheet software' },
      { href: '/features/invoicing-and-payments', label: 'Online payments for cleaning companies' },
      { href: '/pricing', label: 'Pricing' },
    ],
    ctaTitle: 'Run your next week of cleans in Clean Scheduler',
    ctaLead:
      'Try quotes, scheduling, and invoicing free for 7 days — then decide if it beats your current maid service platform.',
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    slug: 'vs-housecall-pro',
    path: '/compare/vs-housecall-pro',
    metaTitle: 'Clean Scheduler vs Housecall Pro for cleaning businesses',
    metaDescription:
      'Compare Clean Scheduler and Housecall Pro for residential and commercial cleaning companies. Features, pricing, pros and cons. 7-day free trial.',
    eyebrow: 'Compare',
    headline: 'Clean Scheduler vs Housecall Pro',
    lead: 'Housecall Pro is a popular all-in-one platform for home service businesses. Here is how it compares to Clean Scheduler for cleaning companies that need quote-to-invoice workflows and bookkeeper-friendly AR.',
    comparisonTable: {
      competitorName: 'Housecall Pro',
      lastVerified: PRICING_VERIFIED,
      rows: [
        {
          feature: 'Built for',
          cleanScheduler: 'Residential & commercial cleaning',
          competitor: 'Home services (HVAC, plumbing, cleaning, etc.)',
        },
        {
          feature: 'Starting price',
          cleanScheduler: '$39/mo (Starter)',
          competitor: '~$79/mo (Basic, 1 user)',
        },
        {
          feature: 'Quote pipeline',
          cleanScheduler: 'Line-item quotes → accepted job → first visit',
          competitor: 'Estimates & proposals',
        },
        {
          feature: 'Recurring scheduling',
          cleanScheduler: 'Recurring visit rules separate from billing',
          competitor: 'Recurring jobs & service plans',
        },
        {
          feature: 'Customer portal',
          cleanScheduler: 'Business+ (reschedule, pay invoices)',
          competitor: 'Customer portal on higher tiers',
        },
        {
          feature: 'Zelle / bank deposit matching',
          cleanScheduler: 'Plaid reconciliation on Business+',
          competitor: 'Not built in',
        },
        {
          feature: 'Payroll export',
          cleanScheduler: 'ADP, Gusto, QuickBooks layouts (Business+)',
          competitor: 'Timesheets; limited payroll export',
        },
        {
          feature: 'Commercial / janitorial',
          cleanScheduler: 'Multi-property accounts & contract AR',
          competitor: 'General field service; less janitorial depth',
        },
        {
          feature: 'Free trial',
          cleanScheduler: '7 days, no credit card',
          competitor: '14-day trial',
        },
      ],
    },
    sections: [
      {
        title: 'The short answer',
        paragraphs: [
          'Choose Housecall Pro if you want a mature home-services platform with strong consumer brand recognition, built-in marketing tools, and a large integration ecosystem.',
          'Choose Clean Scheduler if you run a cleaning business that needs cleaning-specific quote pipelines, mixed residential and commercial books, and month-end AR with Zelle deposit matching.',
        ],
      },
      {
        title: 'Where Housecall Pro wins',
        bullets: [
          'Established brand in home services with extensive marketing features',
          'Online booking and consumer-facing scheduling tools',
          'Large user community and integration marketplace',
          'Invoicing, payments, and dispatch in one familiar package',
          'Strong mobile apps for field technicians',
        ],
      },
      {
        title: 'Where Clean Scheduler wins',
        bullets: [
          'Purpose-built for residential and commercial cleaning workflows',
          'Lower entry price ($39/mo vs ~$79/mo Basic)',
          'Bank deposit reconciliation for Zelle and ACH (Business+)',
          'Month-end close: collections, payment audits, sales tax summary',
          'Quote pipeline designed for cleaning scopes and add-ons',
          '7-day free trial with no credit card required',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
      {
        title: 'Pricing reality check',
        paragraphs: [
          `Pricing last verified ${PRICING_VERIFIED}. Housecall Pro Basic starts around $79/mo for one user; Essentials and Max tiers add automations, marketing, and more seats at higher price points.`,
          'Clean Scheduler Starter is $39/mo; Business is $129/mo with customer portal, payroll export, and bank reconciliation; Pro is $299/mo with SMS and advanced analytics.',
          'For solo and small cleaning teams, Clean Scheduler Starter is often half the entry cost of Housecall Pro Basic while including cleaning-specific month-end reports.',
        ],
        link: { href: '/pricing', label: 'View Clean Scheduler pricing' },
      },
    ],
    faq: [
      {
        question: 'Is Housecall Pro good for commercial cleaning?',
        answer:
          'Housecall Pro works for general field service including some commercial work, but it lacks the janitorial-focused AR and multi-property account depth Clean Scheduler provides for contract operators.',
      },
      {
        question: 'Which has better pricing for small cleaning teams?',
        answer:
          'Clean Scheduler Starter at $39/mo is typically less expensive than Housecall Pro Basic at ~$79/mo for comparable core scheduling and invoicing.',
      },
      {
        question: 'Can I migrate from Housecall Pro to Clean Scheduler?',
        answer:
          'Yes. Import active customers, schedule the next two weeks of visits, and run new invoices from Clean Scheduler while finishing open AR in Housecall Pro.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-jobber', label: 'vs Jobber' },
      { href: '/compare/vs-swept', label: 'vs Swept' },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning software' },
      { href: '/pricing', label: 'Pricing' },
    ],
    ctaTitle: 'Try Clean Scheduler alongside Housecall Pro',
    ctaLead:
      'Run a parallel 7-day trial on your next quotes and recurring visits — no credit card required.',
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    slug: 'vs-swept',
    path: '/compare/vs-swept',
    metaTitle: 'Clean Scheduler vs Swept for commercial cleaning',
    metaDescription:
      'Compare Clean Scheduler and Swept for janitorial and commercial cleaning companies. Scheduling, inspections, AR, and when each platform fits. Free trial.',
    eyebrow: 'Compare',
    headline: 'Clean Scheduler vs Swept',
    lead: 'Swept is built for commercial janitorial operators with inspections and quality control. Clean Scheduler covers commercial and residential with deeper quote-to-invoice and bookkeeper workflows. Here is how they compare.',
    comparisonTable: {
      competitorName: 'Swept',
      lastVerified: PRICING_VERIFIED,
      rows: [
        {
          feature: 'Primary focus',
          cleanScheduler: 'Residential & commercial cleaning',
          competitor: 'Commercial janitorial & inspections',
        },
        {
          feature: 'Residential maid services',
          cleanScheduler: 'Core use case',
          competitor: 'Not a primary focus',
        },
        {
          feature: 'Starting price',
          cleanScheduler: '$39/mo (Starter)',
          competitor: 'Custom pricing (per contract/site)',
        },
        {
          feature: 'Quality inspections',
          cleanScheduler: 'Proof-of-service photos (all plans)',
          competitor: 'Core product — inspection checklists',
        },
        {
          feature: 'Quote pipeline',
          cleanScheduler: 'Full quote stages with line items',
          competitor: 'Contract-focused onboarding',
        },
        {
          feature: 'Invoicing & AR',
          cleanScheduler: 'Invoices, collections, deposit matching',
          competitor: 'Billing & contract management',
        },
        {
          feature: 'Payroll export',
          cleanScheduler: 'ADP, Gusto, QuickBooks (Business+)',
          competitor: 'Time tracking; payroll integrations vary',
        },
        {
          feature: 'Mixed books',
          cleanScheduler: 'Residential + commercial in one workspace',
          competitor: 'Commercial-first',
        },
        {
          feature: 'Free trial',
          cleanScheduler: '7 days, no credit card',
          competitor: 'Demo-based sales',
        },
      ],
    },
    sections: [
      {
        title: 'The short answer',
        paragraphs: [
          'Choose Swept if you are a commercial-only janitorial company that prioritizes inspection checklists, quality audits, and contract compliance tracking above all else.',
          'Choose Clean Scheduler if you run mixed residential and commercial books and need quote pipelines, customer portals, Zelle deposit matching, and month-end close reports in one workspace.',
        ],
      },
      {
        title: 'Where Swept wins',
        bullets: [
          'Purpose-built inspection and quality-control workflows for janitorial contracts',
          'Strong fit for multi-site commercial operators focused on compliance',
          'Contract-centric onboarding and site management',
          'Designed for franchise and large janitorial organizations',
          'Client communication tools tuned for B2B facility managers',
        ],
      },
      {
        title: 'Where Clean Scheduler wins',
        bullets: [
          'Residential and commercial cleaning in one workspace',
          'Transparent self-serve pricing from $39/mo',
          'Quote pipeline with line items for new commercial scopes',
          'Bank deposit matching for Zelle and ACH payments',
          'Payroll export, payment audits, and sales tax summary for bookkeepers',
          '7-day free trial without a sales demo',
        ],
        link: { href: '/start-trial', label: 'Start a 7-day free trial' },
      },
      {
        title: 'Pricing reality check',
        paragraphs: [
          `Pricing last verified ${PRICING_VERIFIED}. Swept typically uses custom contract-based pricing for commercial operators — contact their sales team for quotes.`,
          'Clean Scheduler publishes transparent tiers: Starter $39/mo, Business $129/mo, Pro $299/mo. Solo operators and growing teams can start immediately without a sales cycle.',
          'If you need inspections above all else, Swept may justify custom pricing. If you need AR, mixed books, and self-serve onboarding, Clean Scheduler is faster to try.',
        ],
        link: { href: '/pricing', label: 'View Clean Scheduler pricing' },
      },
    ],
    faq: [
      {
        question: 'Does Clean Scheduler have janitorial inspection checklists like Swept?',
        answer:
          'Clean Scheduler offers proof-of-service photos on every plan but does not match Swept’s depth of inspection audit workflows. If inspections are your primary product requirement, evaluate Swept alongside Clean Scheduler.',
      },
      {
        question: 'Can Clean Scheduler handle large commercial contracts?',
        answer:
          'Yes. Multi-property accounts, recurring visit rules per site, collections reports, and net-term invoicing support janitorial operators growing into commercial work.',
      },
      {
        question: 'Which is better for a company with both homes and offices?',
        answer:
          'Clean Scheduler. Swept is commercial-first. Mixed residential and commercial books are a core Clean Scheduler use case.',
      },
    ],
    relatedLinks: [
      { href: '/compare/vs-housecall-pro', label: 'vs Housecall Pro' },
      { href: '/for/commercial-cleaning-companies', label: 'Commercial cleaning scheduling' },
      {
        href: '/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts',
        label: 'How to get commercial cleaning accounts',
      },
      { href: '/pricing', label: 'Pricing' },
    ],
    ctaTitle: 'Run commercial and residential accounts in one workspace',
    ctaLead:
      'Start a 7-day free trial and schedule your next janitorial route alongside residential homes.',
    sitemapPriority: 0.8,
    changeFrequency: 'monthly',
  },
];
