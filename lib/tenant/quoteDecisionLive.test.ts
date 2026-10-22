import { describe, expect, it } from 'vitest';
import { quoteDecisionNotice, quoteDecisionStatus } from '@/lib/tenant/quoteDecisionLive';

describe('quoteDecisionStatus', () => {
  it('keeps customer decisions and expiry', () => {
    expect(quoteDecisionStatus('accepted')).toBe('accepted');
    expect(quoteDecisionStatus('declined')).toBe('declined');
    expect(quoteDecisionStatus('expired')).toBe('expired');
    expect(quoteDecisionStatus('sent')).toBeNull();
  });
});

describe('quoteDecisionNotice', () => {
  it('names the column the quote moved to', () => {
    expect(quoteDecisionNotice('accepted', 'Deep clean')).toBe(
      '“Deep clean” was accepted and moved to Accepted.',
    );
    expect(quoteDecisionNotice('declined')).toBe('A quote was declined and moved to Declined.');
  });
});
