import { describe, expect, it } from 'vitest';
import {
  QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY,
  claimQuoteSubmit,
  clearQuoteCreateIdempotencyKey,
  failedFollowUpKeys,
  hasPendingFollowUp,
  initialFollowUps,
  quoteCreateIdempotencyKeyForVisit,
  readFollowUps,
} from '@/lib/tenant/quoteCreateIdempotency';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY, initial);
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

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

  it('reuses the stored key on reload and mints a new one for the next visit', () => {
    const stored = '44444444-4444-4444-8444-444444444444';
    const storage = memoryStorage(stored);
    let minted = 0;
    const createId = () => {
      minted += 1;
      return '55555555-5555-4555-8555-555555555555';
    };

    expect(
      quoteCreateIdempotencyKeyForVisit({
        storage,
        navigationType: 'reload',
        createId,
      }),
    ).toBe(stored);
    expect(minted).toBe(0);

    expect(
      quoteCreateIdempotencyKeyForVisit({
        storage,
        navigationType: 'navigate',
        createId,
      }),
    ).toBe('55555555-5555-4555-8555-555555555555');
    expect(storage.values.get(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY)).toBe(
      '55555555-5555-4555-8555-555555555555',
    );

    clearQuoteCreateIdempotencyKey(storage);
    expect(storage.values.has(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY)).toBe(false);
    expect(
      quoteCreateIdempotencyKeyForVisit({
        storage,
        navigationType: 'reload',
        createId,
      }),
    ).toBe('55555555-5555-4555-8555-555555555555');
  });

  it('replaces a stored key that is not a uuid', () => {
    const storage = memoryStorage('not-a-uuid');
    const key = quoteCreateIdempotencyKeyForVisit({
      storage,
      navigationType: 'reload',
      createId: () => '66666666-6666-4666-8666-666666666666',
    });
    expect(key).toBe('66666666-6666-4666-8666-666666666666');
  });

  it('lets the first submit through and blocks the next one', () => {
    const lock = { held: false };
    expect(claimQuoteSubmit(lock)).toBe(true);
    expect(claimQuoteSubmit(lock)).toBe(false);
    lock.held = false;
    expect(claimQuoteSubmit(lock)).toBe(true);
  });
});
