import { describe, expect, it } from 'vitest';
import { SMS_OPT_IN_CHECKBOX_DISCLOSURE, SMS_OPT_IN_MOBILE_DATA_DISCLOSURE } from './smsOptIn';

describe('smsOptIn copy', () => {
  it('includes required 10DLC mobile data sharing language', () => {
    expect(SMS_OPT_IN_MOBILE_DATA_DISCLOSURE).toBe(
      'No mobile information will be sold or shared with third parties for promotional or marketing purposes.',
    );
    expect(SMS_OPT_IN_CHECKBOX_DISCLOSURE).toContain(SMS_OPT_IN_MOBILE_DATA_DISCLOSURE);
  });

  it('includes brand, frequency, rates, STOP, and HELP disclosures', () => {
    expect(SMS_OPT_IN_CHECKBOX_DISCLOSURE).toContain('Clean Scheduler');
    expect(SMS_OPT_IN_CHECKBOX_DISCLOSURE).toContain('Message and data rates may apply');
    expect(SMS_OPT_IN_CHECKBOX_DISCLOSURE).toContain('Message frequency varies');
    expect(SMS_OPT_IN_CHECKBOX_DISCLOSURE).toContain('Reply STOP to opt out');
    expect(SMS_OPT_IN_CHECKBOX_DISCLOSURE).toContain('Reply HELP for help');
  });
});
