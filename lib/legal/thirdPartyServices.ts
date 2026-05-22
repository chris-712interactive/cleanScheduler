/**
 * Third-party services that process data on behalf of cleanScheduler.
 * Keep in sync with integrations in lib/, app/api/webhooks/, and .env.example.
 */

export type ThirdPartyServiceStatus = 'active' | 'planned';

export type ThirdPartyService = {
  name: string;
  status: ThirdPartyServiceStatus;
  /** How this service is used in cleanScheduler. */
  purpose: string;
  /** Categories of data that may be sent to the provider. */
  dataShared: string;
  privacyPolicyUrl: string;
};

/** Services currently wired in application code. */
export const ACTIVE_THIRD_PARTY_SERVICES: ThirdPartyService[] = [
  {
    name: 'Supabase',
    status: 'active',
    purpose:
      'Database, authentication (email/password and OAuth), file storage (logos, avatars, report exports), and scheduled database jobs.',
    dataShared:
      'Account credentials and profile data; workspace and business records; customer, schedule, quote, invoice, and billing data; uploaded files; session tokens.',
    privacyPolicyUrl: 'https://supabase.com/privacy',
  },
  {
    name: 'Stripe',
    status: 'active',
    purpose:
      'Platform subscriptions (Starter, Business, Pro), Stripe Connect Express onboarding and payouts for tenants, customer invoice and subscription checkout, refunds, disputes, and payout reconciliation.',
    dataShared:
      'Names, emails, business identifiers; payment method and transaction metadata; subscription and invoice amounts; Connect account status; webhook event payloads.',
    privacyPolicyUrl: 'https://stripe.com/privacy',
  },
  {
    name: 'Resend',
    status: 'active',
    purpose:
      'Transactional email (quotes, invoices, trial reminders, employee invites, dispute alerts) and tenant email campaigns with delivery analytics webhooks.',
    dataShared:
      'Recipient email addresses and display names; message subject and body; tenant branding; campaign tags; open/click/bounce events.',
    privacyPolicyUrl: 'https://resend.com/legal/privacy-policy',
  },
  {
    name: 'Google',
    status: 'active',
    purpose:
      'Optional “Sign in with Google” through Supabase Auth (OAuth). Google does not receive your cleanScheduler workspace data directly.',
    dataShared:
      'OAuth profile information (such as name and email) handled by Supabase Auth during sign-in.',
    privacyPolicyUrl: 'https://policies.google.com/privacy',
  },
  {
    name: 'Vercel',
    status: 'active',
    purpose:
      'Application hosting, preview deployments, and scheduled cron jobs that invoke internal maintenance routes.',
    dataShared:
      'HTTP request metadata (IP address, user agent, URLs); application logs; environment configuration secrets (not exposed to end users).',
    privacyPolicyUrl: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'Twilio',
    status: 'active',
    purpose:
      'Pro plan transactional SMS — quote notifications, visit reminders, and team alerts via Twilio when configured.',
    dataShared: 'Phone numbers and message content for outbound SMS.',
    privacyPolicyUrl: 'https://www.twilio.com/en-us/legal/privacy',
  },
];

/**
 * Services documented in environment configuration but not yet invoked from application code.
 * Listed in the Privacy Policy so users are informed if we enable them later.
 */
export const PLANNED_THIRD_PARTY_SERVICES: ThirdPartyService[] = [
  {
    name: 'Sentry',
    status: 'planned',
    purpose: 'Error and performance monitoring when enabled.',
    dataShared:
      'Error stack traces, request context, and performance spans (configured to minimize personal data).',
    privacyPolicyUrl: 'https://sentry.io/privacy/',
  },
  {
    name: 'Plaid',
    status: 'planned',
    purpose: 'Bank account linking and transaction import for reconciliation features.',
    dataShared:
      'Bank connection tokens, account and transaction metadata (when a tenant or user connects a bank).',
    privacyPolicyUrl: 'https://plaid.com/legal/#end-user-privacy-policy',
  },
];

export const ALL_THIRD_PARTY_SERVICES: ThirdPartyService[] = [
  ...ACTIVE_THIRD_PARTY_SERVICES,
  ...PLANNED_THIRD_PARTY_SERVICES,
];
