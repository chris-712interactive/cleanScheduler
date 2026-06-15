import type { TenantMarketingPageType } from '@/lib/tenantSite/types';

export type TenantSitePageTemplate = {
  slug: string;
  pageType: TenantMarketingPageType;
  sortOrder: number;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  lead: string;
  sections: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
  faq: Array<{ question: string; answer: string }>;
};

export const DEFAULT_TENANT_SITE_TEMPLATES: TenantSitePageTemplate[] = [
  {
    slug: 'home',
    pageType: 'home',
    sortOrder: 0,
    metaTitle: 'Professional cleaning services',
    metaDescription:
      'Reliable residential and commercial cleaning. Request a free quote for recurring or one-time service.',
    eyebrow: 'Cleaning services',
    headline: 'A cleaner space, without the hassle',
    lead: 'We handle recurring home cleaning, deep cleans, and move-out services with a team you can trust.',
    sections: [
      {
        title: 'Why homeowners choose us',
        paragraphs: [
          'Transparent pricing, consistent crews, and easy online scheduling. We show up on time and leave your space spotless.',
        ],
        bullets: [
          'Fully insured cleaning professionals',
          'Flexible weekly, bi-weekly, or monthly plans',
          'Easy quote and booking online',
        ],
      },
    ],
    faq: [
      {
        question: 'Do you bring supplies and equipment?',
        answer:
          'Yes. Our team arrives with professional-grade supplies unless you prefer we use yours.',
      },
      {
        question: 'How do I get a quote?',
        answer:
          'Use the contact form on this site or call us directly. We respond within one business day.',
      },
    ],
  },
  {
    slug: 'services',
    pageType: 'services',
    sortOrder: 1,
    metaTitle: 'Our cleaning services',
    metaDescription:
      'Recurring home cleaning, deep cleans, move-in/move-out, and commercial janitorial services.',
    eyebrow: 'Services',
    headline: 'Cleaning services tailored to your home or business',
    lead: 'From weekly maintenance to one-time deep cleans, we build a plan that fits your schedule and budget.',
    sections: [
      {
        title: 'Residential cleaning',
        bullets: [
          'Standard recurring cleans',
          'Deep cleaning and seasonal refreshes',
          'Move-in and move-out cleaning',
        ],
      },
      {
        title: 'Commercial cleaning',
        bullets: [
          'Office and retail maintenance',
          'After-hours scheduling available',
          'Custom checklists for your facility',
        ],
      },
    ],
    faq: [],
  },
  {
    slug: 'about',
    pageType: 'about',
    sortOrder: 2,
    metaTitle: 'About our cleaning company',
    metaDescription:
      'Meet our team and learn how we deliver consistent, trustworthy cleaning services.',
    eyebrow: 'About us',
    headline: 'Local cleaners who treat your space like our own',
    lead: 'We started this company to bring reliable, professional cleaning to our community — with clear communication and fair pricing.',
    sections: [
      {
        title: 'Our promise',
        paragraphs: [
          'Every visit is backed by trained staff, quality checklists, and responsive customer support.',
        ],
      },
    ],
    faq: [],
  },
  {
    slug: 'contact',
    pageType: 'contact',
    sortOrder: 3,
    metaTitle: 'Contact us',
    metaDescription: 'Request a quote or ask a question. We respond within one business day.',
    eyebrow: 'Contact',
    headline: 'Request a quote',
    lead: 'Tell us about your space and we will follow up with pricing and availability.',
    sections: [],
    faq: [],
  },
];
