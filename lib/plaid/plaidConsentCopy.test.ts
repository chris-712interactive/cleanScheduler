import { describe, expect, it } from 'vitest';
import { PLAID_CONSENT_REQUIRED_ERROR, PLAID_PRE_LINK } from '@/lib/plaid/plaidConsentCopy';

describe('plaidConsentCopy', () => {
  it('includes required disclosure links', () => {
    expect(PLAID_PRE_LINK.plaidPrivacyUrl).toContain('plaid.com');
    expect(PLAID_PRE_LINK.bullets.length).toBeGreaterThanOrEqual(3);
  });

  it('defines consent error message', () => {
    expect(PLAID_CONSENT_REQUIRED_ERROR.length).toBeGreaterThan(10);
  });
});
