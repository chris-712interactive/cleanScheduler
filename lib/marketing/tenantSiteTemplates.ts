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
    link?: { href: string; label: string };
  }>;
  faq: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ href: string; label: string }>;
  ctaTitle?: string;
  ctaLead?: string;
};

type TemplateInput = {
  businessName?: string | null;
  city?: string | null;
  state?: string | null;
};

function placeLabel(input: TemplateInput): string | null {
  const city = input.city?.trim() || '';
  const state = input.state?.trim() || '';
  if (city && state) return `${city}, ${state}`;
  return city || state || null;
}

function businessName(input: TemplateInput): string {
  return input.businessName?.trim() || 'our team';
}

/**
 * Starter pages for a new tenant marketing site.
 * Copy stays editable in the CMS. It names the business and city when those
 * are already on the workspace, and it does not invent reviews, prices, or years in business.
 */
export function buildDefaultTenantSiteTemplates(
  input: TemplateInput = {},
): TenantSitePageTemplate[] {
  const name = businessName(input);
  const place = placeLabel(input);
  const placeIn = place ? ` in ${place}` : '';
  const placeFor = place ? ` for ${place}` : '';

  return [
    {
      slug: 'home',
      pageType: 'home',
      sortOrder: 0,
      metaTitle: place ? `House and office cleaning in ${place}` : 'House and office cleaning',
      metaDescription: `${name} handles recurring home cleaning, deep cleans, and move-out service${placeIn}. Request a quote and hear back within one business day.`,
      eyebrow: place ? `Cleaning${placeIn}` : 'Cleaning services',
      headline: place
        ? `A cleaner home in ${place.split(',')[0]}`
        : 'A cleaner space, without the hassle',
      lead: `${name} takes care of recurring home cleaning, deep cleans, and move-out service with a consistent crew and a clear checklist.`,
      sections: [
        {
          title: 'Why customers book us',
          paragraphs: [
            'You get a written scope, a crew that follows the same checklist every visit, and a direct way to reschedule when life changes.',
          ],
          bullets: [
            'Insured cleaning professionals',
            'Weekly, biweekly, or monthly plans',
            'Quotes by phone or this website',
          ],
        },
        {
          title: 'How a visit works',
          bullets: [
            'Tell us about the home or workplace and how often you want it cleaned.',
            'We confirm the scope, price, and a start date that fits your calendar.',
            'The crew arrives with supplies and works through a room-by-room checklist.',
          ],
        },
        {
          title: 'Homes and workplaces',
          paragraphs: [
            `From apartments and family homes to offices that need an after-hours clean, ${name} builds the visit around how the space is actually used.`,
          ],
          link: { href: '/services', label: 'See cleaning services' },
        },
      ],
      faq: [
        {
          question: 'Do you bring supplies and equipment?',
          answer:
            'Yes. The crew arrives with professional supplies and equipment unless you ask us to use products already in the space.',
        },
        {
          question: 'How do I get a quote?',
          answer:
            'Send the form on this site or call during business hours. We follow up within one business day with pricing and the next open start date.',
        },
        {
          question: 'Do you offer recurring cleaning?',
          answer:
            'Yes. Most customers choose weekly, every other week, or monthly. One-time deep cleans and move-out cleans are available too.',
        },
      ],
      relatedLinks: [
        { href: '/services', label: 'Cleaning services' },
        { href: '/about', label: 'About the company' },
        { href: '/faq', label: 'Common questions' },
        { href: '/contact', label: 'Request a quote' },
      ],
      ctaTitle: `Ready for a cleaner space${placeFor}?`,
      ctaLead:
        'Tell us about the space and how often you want it cleaned. We will follow up with pricing and availability.',
    },
    {
      slug: 'services',
      pageType: 'services',
      sortOrder: 1,
      metaTitle: place ? `Cleaning services in ${place}` : 'Cleaning services',
      metaDescription: `Recurring home cleaning, deep cleaning, move-in and move-out, and office cleaning${placeIn}. Choose a plan and request a quote from ${name}.`,
      eyebrow: 'Services',
      headline: place
        ? `Cleaning services for homes and offices in ${place.split(',')[0]}`
        : 'Cleaning services for homes and offices',
      lead: 'Pick the visit that matches the space. Every service uses a written checklist so the result is the same from one appointment to the next.',
      sections: [
        {
          title: 'Recurring home cleaning',
          paragraphs: [
            'A maintenance clean for kitchens, bathrooms, floors, and the surfaces you use every day. Most homes are weekly or every other week.',
          ],
          bullets: [
            'Kitchens and bathrooms detailed each visit',
            'Floors vacuumed and mopped',
            'Beds made and common areas reset',
          ],
        },
        {
          title: 'Deep cleaning',
          paragraphs: [
            'A top-to-bottom reset for a home that needs more than a maintenance visit — often before a recurring plan starts, or once a season.',
          ],
          bullets: [
            'Baseboards, doors, and switch plates',
            'Inside microwave and other appliance fronts',
            'Extra time in kitchens and bathrooms',
          ],
        },
        {
          title: 'Move-in and move-out cleaning',
          paragraphs: [
            'An empty-home clean for landlords, tenants, and anyone handing over keys. We focus on the details a walkthrough actually checks.',
          ],
          bullets: [
            'Inside cabinets, closets, and appliances on request',
            'Bathrooms and kitchens brought back to empty-home standard',
            'Scheduled around your closing or lease date',
          ],
        },
        {
          title: 'Office and commercial cleaning',
          paragraphs: [
            'After-hours or daytime cleaning for offices, studios, and small retail spaces, with a checklist written for that workplace.',
          ],
          bullets: [
            'Desks, kitchens, and restrooms',
            'Trash, floors, and glass at the entrance',
            'A schedule that stays out of the workday when you need it to',
          ],
          link: { href: '/contact', label: 'Request a workplace quote' },
        },
      ],
      faq: [
        {
          question: 'What is included in a standard clean?',
          answer:
            'A standard recurring visit covers kitchens, bathrooms, floors, dusting, and a reset of living areas. Add-ons such as inside the oven or fridge are quoted separately.',
        },
        {
          question: 'Can you clean on a one-time basis?',
          answer:
            'Yes. Deep cleans and move-out cleans are booked as one visit. Many customers start there and then move to a recurring plan.',
        },
      ],
      relatedLinks: [
        { href: '/contact', label: 'Request a quote' },
        { href: '/faq', label: 'Questions about booking' },
        { href: '/about', label: 'How we work' },
      ],
      ctaTitle: 'Tell us which clean you need',
      ctaLead:
        'Share the size of the space and whether you want a one-time visit or a recurring plan.',
    },
    {
      slug: 'about',
      pageType: 'about',
      sortOrder: 2,
      metaTitle: place ? `About ${name} in ${place}` : `About ${name}`,
      metaDescription: `${name} is a local cleaning company${placeIn}. Every visit follows a checklist, and you can reach the office directly when plans change.`,
      eyebrow: 'About',
      headline: place
        ? `Local cleaners serving ${place.split(',')[0]}`
        : 'Local cleaners who treat the space like their own',
      lead: `${name} exists to make professional cleaning easy to book and easy to trust — with a clear scope, a consistent crew, and someone who answers when you call.`,
      sections: [
        {
          title: 'What you can expect',
          paragraphs: [
            'Before the first visit we agree on rooms, frequency, and anything that needs extra care. The crew follows that checklist, and you hear from us if anything looks different on site.',
          ],
          bullets: [
            'The same standard from one visit to the next',
            'Supplies brought to the door',
            'A real person to call about schedule changes',
          ],
        },
        {
          title: 'Who we clean for',
          paragraphs: [
            'Homeowners, renters, property managers, and small businesses that want the place cleaned without managing a crew themselves.',
          ],
        },
      ],
      faq: [],
      relatedLinks: [
        { href: '/services', label: 'Services' },
        { href: '/contact', label: 'Contact' },
      ],
      ctaTitle: `Work with ${name}`,
      ctaLead: 'Request a quote and we will follow up with a scope and a start date.',
    },
    {
      slug: 'faq',
      pageType: 'faq',
      sortOrder: 3,
      metaTitle: place ? `Cleaning FAQs for ${place}` : 'Cleaning questions, answered',
      metaDescription: `Answers about supplies, pricing, rescheduling, pets, and office cleaning from ${name}${placeIn}.`,
      eyebrow: 'FAQ',
      headline: 'Questions customers ask before they book',
      lead: 'Straight answers about how a visit works. If yours is not here, send a note and we will reply within one business day.',
      sections: [
        {
          title: 'Still deciding?',
          paragraphs: [
            'The services page lists what a recurring clean, a deep clean, a move-out, and an office visit include. The quote form is the fastest way to get a price for your space.',
          ],
          link: { href: '/services', label: 'Compare services' },
        },
      ],
      faq: [
        {
          question: 'Are the cleaners insured?',
          answer:
            'Yes. The team is insured for the work they do in your home or workplace. Ask us if you need a certificate for a building or property manager.',
        },
        {
          question: 'Do I need to be home?',
          answer:
            'No. Most customers leave a key, a code, or a lockbox. We confirm how we will get in before the first visit and lock up the same way when we leave.',
        },
        {
          question: 'What if I need to reschedule?',
          answer:
            'Contact the office as soon as you know. We will move the visit to the next opening that works for you and the crew.',
        },
        {
          question: 'How do you price a clean?',
          answer:
            'Price depends on the size of the space, the condition, how often we come, and any add-ons. We quote it before the first visit so there is no surprise invoice.',
        },
        {
          question: 'Do you clean around pets?',
          answer:
            'Yes. Tell us about pets when you book so the crew knows who will be home and which rooms to close off.',
        },
        {
          question: 'Do you clean offices as well as homes?',
          answer:
            'Yes. Office and small commercial visits use their own checklist and can be scheduled after hours.',
        },
      ],
      relatedLinks: [
        { href: '/services', label: 'Services' },
        { href: '/contact', label: 'Request a quote' },
      ],
      ctaTitle: 'Have a question we did not answer?',
      ctaLead: 'Send a few details about the space and we will reply with a clear next step.',
    },
    {
      slug: 'contact',
      pageType: 'contact',
      sortOrder: 4,
      metaTitle: place ? `Request a cleaning quote in ${place}` : 'Request a cleaning quote',
      metaDescription: `Contact ${name} for a cleaning quote${placeIn}. Share the space and how often you need it, and we reply within one business day.`,
      eyebrow: 'Contact',
      headline: 'Request a quote',
      lead: `Tell ${name} about the home or workplace. We reply within one business day with pricing and the next available start.`,
      sections: [
        {
          title: 'What happens next',
          bullets: [
            'We read your note and confirm the type of clean.',
            'We send a price and a proposed start date.',
            'You approve it, and the first visit goes on the calendar.',
          ],
        },
      ],
      faq: [],
      relatedLinks: [
        { href: '/services', label: 'Browse services first' },
        { href: '/faq', label: 'Read the FAQ' },
      ],
    },
  ];
}

export const DEFAULT_TENANT_SITE_TEMPLATES = buildDefaultTenantSiteTemplates();
