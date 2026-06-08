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
    title: 'Message your cleaning provider',
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
      { href: '/help/tcr', label: 'SMS opt-in and portal setup' },
      { href: '/help/faq', label: 'FAQ' },
      { href: '/help/contact', label: 'Contact Clean Scheduler support' },
    ],
    sitemapPriority: 0.55,
    changeFrequency: 'monthly',
  },
];

export function getCustomerHelpArticle(slug: string): HelpGuideArticle | undefined {
  return CUSTOMER_HELP_ARTICLES.find((article) => article.slug === slug);
}
