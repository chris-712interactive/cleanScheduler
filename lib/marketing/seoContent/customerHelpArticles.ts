import type { HelpGuideArticle } from './types';

export const CUSTOMER_HELP_HUB = {
  slug: 'customers',
  path: '/help/customers',
  title: 'For Customers',
  description: 'Guides for homeowners and customer portal users.',
  sectionTitle: 'Top tasks',
};

export const CUSTOMER_HELP_ARTICLES: HelpGuideArticle[] = [
  {
    slug: 'message-your-provider',
    path: '/help/customers/message-your-provider',
    title: 'Message your provider',
    description:
      'Start a conversation, follow up on open threads, and know what to expect when you contact your provider from the customer portal.',
    sections: [
      {
        title: 'Where to find Messages',
        paragraphs: [
          'Sign in to your customer portal (the link your cleaning company sent you, or my.cleanscheduler.com). Open Messages in the sidebar to see every conversation with your providers.',
          'If you work with more than one cleaning company on Clean Scheduler, pick the provider when you start a new message.',
        ],
        figures: [
          {
            src: '/help/customers/messages-list.svg',
            alt: 'Customer portal Messages list with a new message button and thread previews',
            caption: 'The Messages area lists your conversations with each provider.',
          },
        ],
      },
      {
        title: 'Start a new conversation',
        paragraphs: [
          'Tap or click New message, choose your provider, add a short subject, and write your question. Your provider’s office team sees it in their workspace inbox.',
        ],
        bullets: [
          'Use a clear subject (for example “Reschedule question” or “Billing on last invoice”).',
          'Include the address or appointment date if it helps them find your account faster.',
          'You do not need to call or email separately — replies stay in the same thread.',
        ],
      },
      {
        title: 'Reply on an open thread',
        paragraphs: [
          'Open any active conversation to read the full history. When the thread is still open, you can type a reply at the bottom and send it.',
          'Your provider is notified by email when you send or reply (they can turn this off in their settings).',
        ],
        figures: [
          {
            src: '/help/customers/message-thread.svg',
            alt: 'Customer portal message thread with transcript and reply box',
            caption: 'Open threads show the full conversation and a reply box at the bottom.',
          },
        ],
      },
      {
        title: 'When a conversation is closed',
        paragraphs: [
          'Providers may close a thread after your question is resolved. Closed threads are read-only — start a new message if you need more help.',
        ],
        tip: 'For urgent scheduling changes, also check Schedule in your portal to view upcoming visits or request a reschedule.',
      },
    ],
    faq: [
      {
        question: 'Will I get an email when my provider replies?',
        answer:
          'You see replies when you sign in to Messages. Email alerts for provider replies are not sent to customers today — check your portal or ask your provider to contact you another way if needed.',
      },
      {
        question: 'Can I text my provider instead?',
        answer:
          'Some companies send visit reminders or quote links by text. Two-way texting in Messages is in-app only; use the portal for a written record both sides can reference.',
      },
      {
        question: 'I do not see Messages in my portal',
        answer:
          'Your provider must invite you to their customer portal first. Accept the invite email, finish setup, then Messages appears in the navigation.',
      },
    ],
    relatedLinks: [
      { href: '/help/customers/manage-appointments', label: 'Manage appointments' },
      { href: '/help/customers/pay-invoices', label: 'Pay invoices' },
      { href: '/help/tcr', label: 'SMS opt-in and portal setup' },
      { href: '/help/faq', label: 'FAQ' },
    ],
    sitemapPriority: 0.55,
    changeFrequency: 'monthly',
  },
  {
    slug: 'manage-appointments',
    path: '/help/customers/manage-appointments',
    title: 'Manage appointments',
    description:
      'View upcoming cleanings, see your assigned crew, request a reschedule, and review recent completed visits in the customer portal.',
    sections: [
      {
        title: 'Open your schedule',
        paragraphs: [
          'Sign in to your customer portal and open Schedule (or Upcoming visits) in the sidebar. You see every future cleaning your provider has booked for you, grouped by provider when you use more than one company.',
        ],
        figures: [
          {
            src: '/help/customers/upcoming-visits.svg',
            alt: 'Customer portal upcoming visits list with reschedule buttons',
            caption:
              'Each upcoming visit shows date, time, provider, and a Reschedule action when eligible.',
          },
        ],
      },
      {
        title: 'Request a reschedule',
        paragraphs: [
          'Tap Reschedule on a visit that has not started yet. Pick your preferred new date and time and add an optional note. Your provider receives the request in their workspace and confirms or follows up.',
        ],
        bullets: [
          'You can request a reschedule only on scheduled visits that have not checked in yet.',
          'If a request is already pending, the visit shows a pending badge until staff responds.',
          'Your provider approves the change — the portal sends the request, not an automatic calendar move.',
        ],
      },
      {
        title: 'Completed visits and proof photos',
        paragraphs: [
          'Recent completed visits may appear below your upcoming list. On Pro plans where your provider enables it, you may see proof-of-service photos after a job is marked complete.',
        ],
        tip: 'Need a change urgently? Send a message from Messages after submitting a reschedule request so the office team sees both.',
      },
    ],
    faq: [
      {
        question: 'Why is Reschedule missing on a visit?',
        answer:
          'Reschedule is hidden after a visit starts, completes, or is canceled. Past visits cannot be moved from the portal.',
      },
      {
        question: 'How long until my new time is confirmed?',
        answer:
          'That depends on your provider. They review reschedule requests in their tenant workspace and update your visit when approved.',
      },
    ],
    relatedLinks: [
      { href: '/help/customers/message-your-provider', label: 'Message your provider' },
      { href: '/help/customers/pay-invoices', label: 'Pay invoices' },
      { href: '/help/tcr', label: 'Portal setup and SMS opt-in' },
    ],
    sitemapPriority: 0.55,
    changeFrequency: 'monthly',
  },
  {
    slug: 'pay-invoices',
    path: '/help/customers/pay-invoices',
    title: 'Pay invoices',
    description:
      'Find open invoices, review balance and payment history, apply promos or wallet credit when offered, and pay online when your provider accepts card payments.',
    sections: [
      {
        title: 'Find your invoices',
        paragraphs: [
          'Open Billing or Invoices in the customer portal. Every invoice from connected providers appears with status, balance, and due date when your provider sets one.',
        ],
      },
      {
        title: 'Review and pay an open invoice',
        paragraphs: [
          'Open an invoice to see the total, amount paid, and balance due. If your provider completed Stripe Connect setup, Pay with card starts a secure checkout for the remaining balance.',
        ],
        figures: [
          {
            src: '/help/customers/pay-invoice.svg',
            alt: 'Customer portal invoice detail with balance and pay button',
            caption:
              'Invoice detail shows balance due and a Pay with card button when online payments are enabled.',
          },
        ],
        bullets: [
          'Some providers also link a hosted Stripe invoice or PDF — use those links when shown.',
          'Promo codes and account wallet credit appear on the invoice when your provider enables promotions.',
          'After payment, status and balance update when checkout completes successfully.',
        ],
      },
      {
        title: 'Payment history',
        paragraphs: [
          'The invoice detail page lists recorded payments (card, check, cash, and other methods your provider logs). Contact your provider if a payment is missing or looks incorrect.',
        ],
        tip: 'Card pay requires your cleaning company to finish online payment setup. If you do not see Pay with card, message them or pay using their usual offline method.',
      },
    ],
    faq: [
      {
        question: 'Is my card charged by Clean Scheduler?',
        answer:
          'No. Card payments go to your cleaning provider through their connected Stripe account. Clean Scheduler provides the portal and checkout flow.',
      },
      {
        question: 'Can I pay part of an invoice?',
        answer:
          'Online checkout pays the current balance due shown on the invoice. Partial offline payments are recorded by your provider in their system.',
      },
    ],
    relatedLinks: [
      { href: '/help/customers/message-your-provider', label: 'Message your provider' },
      { href: '/help/customers/manage-appointments', label: 'Manage appointments' },
      { href: '/help/faq', label: 'FAQ' },
    ],
    sitemapPriority: 0.55,
    changeFrequency: 'monthly',
  },
];

export function getCustomerHelpArticle(slug: string): HelpGuideArticle | undefined {
  return CUSTOMER_HELP_ARTICLES.find((article) => article.slug === slug);
}
