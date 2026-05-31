import { PRODUCT_NAME } from '@/lib/legal/site';

/** Pre-Link disclosure copy aligned with Plaid messaging best practices. */
export const PLAID_PRE_LINK = {
  headline: 'Connect your business bank account',
  intro: `${PRODUCT_NAME} uses Plaid to securely connect your business checking account. Plaid is a trusted service used by thousands of financial apps.`,
  bullets: [
    'We import recent deposit transactions to suggest matches against open invoices (Zelle, ACH, and similar transfers).',
    `${PRODUCT_NAME} never sees or stores your bank login credentials — authentication happens directly with your bank through Plaid.`,
    'Connection uses bank-grade encryption. You can disconnect at any time from this page; we revoke the Plaid connection and stop syncing.',
  ],
  plaidPrivacyUrl: 'https://plaid.com/legal/#end-user-privacy-policy',
  checkboxLabel:
    'I authorize cleanScheduler to access my linked account information through Plaid for bank reconciliation as described above, and I have read the Privacy Policy.',
} as const;

export const PLAID_CONSENT_REQUIRED_ERROR =
  'You must review and accept the bank connection notice before continuing to Plaid.';
