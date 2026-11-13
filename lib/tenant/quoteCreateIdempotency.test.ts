import { describe, expect, it } from 'vitest';
import {
  claimQuoteSubmit,
  failedFollowUpKeys,
  hasPendingFollowUp,
  initialFollowUps,
  readFollowUps,
} from '@/lib/tenant/quoteCreateIdempotency';

describe('quote create idempotency', () => {
  it('retries only failed follow-ups', () => {
    const stored = initialFollowUps(true);
    stored.locationFacts = 'ok';
    stored.locationKind = 'ok';
    stored.crew = 'ok';
    stored.promotions = 'ok';
    stored.email = 'ok';
    stored.sms = 'failed';
    stored.entryCodes = 'failed';
    stored.webhook = 'skipped';
    expect(failedFollowUpKeys(stored)).toEqual(['entryCodes', 'sms']);
    expect(hasPendingFollowUp(initialFollowUps(true))).toBe(true);
    expect(hasPendingFollowUp(stored)).toBe(false);
  });

  it('does not treat inherited or unknown follow-up values as work to retry', () => {
    const stored = readFollowUps({
      email: 'ok',
      sms: 'failed',
      constructor: 'failed',
      toString: 'failed',
    });
    expect(stored.email).toBe('ok');
    expect(stored.sms).toBe('failed');
    expect(stored.entryCodes).toBe('skipped');
    expect(failedFollowUpKeys(stored)).toEqual(['sms']);
  });

  it('lets the first submit through and blocks the next one', () => {
    const lock = { held: false };
    expect(claimQuoteSubmit(lock)).toBe(true);
    expect(claimQuoteSubmit(lock)).toBe(false);
    lock.held = false;
    expect(claimQuoteSubmit(lock)).toBe(true);
  });
});
