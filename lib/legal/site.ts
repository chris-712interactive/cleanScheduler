/** Product and legal contact constants shared by public legal pages. */

export const PRODUCT_NAME = 'Clean Scheduler';

/** Shown on legal pages; update when policies materially change. */
export const LEGAL_LAST_UPDATED = 'June 25, 2026';

/** Primary channel for privacy and legal requests (also reachable via /contact). */
export const LEGAL_CONTACT_EMAIL = 'legal@712int.com';

/** Official business address published in the site footer and compliance materials. */
export const LEGAL_BUSINESS_ADDRESS = {
  line1: '5830 E 2nd St, STE 6300',
  line2: 'Casper, WY 82609',
  streetAddress: '5830 E 2nd St, STE 6300',
  addressLocality: 'Casper',
  addressRegion: 'WY',
  postalCode: '82609',
  addressCountry: 'US',
} as const;

export function formatLegalBusinessAddress(options?: { multiline?: boolean }): string {
  const { multiline = false } = options ?? {};
  return multiline
    ? `${LEGAL_BUSINESS_ADDRESS.line1}\n${LEGAL_BUSINESS_ADDRESS.line2}`
    : `${LEGAL_BUSINESS_ADDRESS.line1}, ${LEGAL_BUSINESS_ADDRESS.line2}`;
}
