import { describe, expect, it } from 'vitest';
import {
  QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY,
  STALE_FOLLOW_UP_MS,
  claimQuoteSubmit,
  clearQuoteCreateIdempotencyKey,
  failedFollowUpKeys,
  followUpWriteAllowed,
  hasPendingFollowUp,
  initialFollowUps,
  isStalePending,
  markQuoteCreateIdempotencySubmitted,
  quoteCreateIdempotencyKeyForVisit,
  quoteCreateWarningKeepsIdempotencyKey,
  readFollowUpRecord,
  readFollowUps,
  resetQuoteCreateVisitMemory,
  resolveQuoteCreateIdempotencyKey,
  retryableFollowUpSteps,
} from '@/lib/tenant/quoteCreateIdempotency';

const STORED_KEY = '44444444-4444-4444-8444-444444444444';
const NEXT_KEY = '55555555-5555-4555-8555-555555555555';
const WIZARD_PATH = '/quotes/new';

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

function visitInput(
  storage: ReturnType<typeof memoryStorage>,
  overrides: Partial<Parameters<typeof quoteCreateIdempotencyKeyForVisit>[0]> = {},
) {
  return {
    storage,
    navigationType: 'navigate',
    navigationPath: WIZARD_PATH,
    currentPath: WIZARD_PATH,
    laterVisitInDocument: false,
    backForward: false,
    createId: () => NEXT_KEY,
    ...overrides,
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

  it('reuses a submitted key only when this wizard document was reloaded or restored', () => {
    const storage = memoryStorage();
    quoteCreateIdempotencyKeyForVisit(visitInput(storage, { createId: () => STORED_KEY }));
    markQuoteCreateIdempotencySubmitted(storage, WIZARD_PATH);

    expect(
      quoteCreateIdempotencyKeyForVisit(
        visitInput(storage, { navigationType: 'reload', createId: () => NEXT_KEY }),
      ),
    ).toBe(STORED_KEY);

    expect(
      quoteCreateIdempotencyKeyForVisit(
        visitInput(storage, {
          navigationType: 'reload',
          navigationPath: '/quotes',
          createId: () => NEXT_KEY,
        }),
      ),
    ).toBe(NEXT_KEY);

    markQuoteCreateIdempotencySubmitted(storage, WIZARD_PATH);
    expect(
      quoteCreateIdempotencyKeyForVisit(
        visitInput(storage, {
          navigationType: 'reload',
          laterVisitInDocument: true,
          createId: () => '66666666-6666-4666-8666-666666666666',
        }),
      ),
    ).toBe('66666666-6666-4666-8666-666666666666');
  });

  it('reuses the submitted key on back and drops it after a finished save', () => {
    const storage = memoryStorage();
    quoteCreateIdempotencyKeyForVisit(visitInput(storage, { createId: () => STORED_KEY }));
    markQuoteCreateIdempotencySubmitted(storage, WIZARD_PATH);

    expect(
      quoteCreateIdempotencyKeyForVisit(
        visitInput(storage, {
          navigationType: 'back_forward',
          createId: () => NEXT_KEY,
        }),
      ),
    ).toBe(STORED_KEY);
    expect(
      quoteCreateIdempotencyKeyForVisit(
        visitInput(storage, {
          navigationType: 'navigate',
          navigationPath: '/quotes',
          laterVisitInDocument: true,
          backForward: true,
          createId: () => NEXT_KEY,
        }),
      ),
    ).toBe(STORED_KEY);

    expect(quoteCreateWarningKeepsIdempotencyKey('entry-codes,quote-in-flight')).toBe(true);
    expect(quoteCreateWarningKeepsIdempotencyKey('quote-notify')).toBe(false);
    clearQuoteCreateIdempotencyKey(storage);
    expect(
      quoteCreateIdempotencyKeyForVisit(
        visitInput(storage, { navigationType: 'back_forward', createId: () => NEXT_KEY }),
      ),
    ).toBe(NEXT_KEY);
  });

  it('keeps one key across a strict-mode remount and mints another on the next visit', () => {
    resetQuoteCreateVisitMemory();
    const storage = memoryStorage();
    const first = resolveQuoteCreateIdempotencyKey({
      storage,
      createId: () => STORED_KEY,
      nowMs: 1_000,
      navigationType: 'reload',
      navigationPath: WIZARD_PATH,
      currentPath: WIZARD_PATH,
    });
    const remount = resolveQuoteCreateIdempotencyKey({
      storage,
      createId: () => NEXT_KEY,
      nowMs: 1_050,
      navigationType: 'reload',
      navigationPath: WIZARD_PATH,
      currentPath: WIZARD_PATH,
    });
    expect(first).toBe(STORED_KEY);
    expect(remount).toBe(STORED_KEY);

    markQuoteCreateIdempotencySubmitted(storage, WIZARD_PATH);
    const later = resolveQuoteCreateIdempotencyKey({
      storage,
      createId: () => NEXT_KEY,
      nowMs: 5_000,
      navigationType: 'reload',
      navigationPath: WIZARD_PATH,
      currentPath: WIZARD_PATH,
    });
    expect(later).toBe(NEXT_KEY);
    resetQuoteCreateVisitMemory();
  });

  it('treats a pending step as retryable only after the stale window', () => {
    const followUps = readFollowUpRecord({
      sms: 'pending',
      email: 'failed',
      claimedAt: { sms: new Date(1_000).toISOString() },
      claimToken: { sms: 'owner-a' },
    });
    expect(isStalePending(followUps, 'sms', 1_000 + STALE_FOLLOW_UP_MS - 1)).toBe(false);
    expect(isStalePending(followUps, 'sms', 1_000 + STALE_FOLLOW_UP_MS)).toBe(true);
    expect(retryableFollowUpSteps(followUps, 1_000)).toEqual(['email']);
    expect(retryableFollowUpSteps(followUps, 1_000 + STALE_FOLLOW_UP_MS)).toEqual(['email', 'sms']);
    expect(followUpWriteAllowed(followUps, 'sms', 'failed', 'owner-b')).toBe(false);
    followUps.sms = 'ok';
    expect(followUpWriteAllowed(followUps, 'sms', 'failed', 'owner-a')).toBe(false);
  });

  it('replaces a stored key that is not a uuid', () => {
    const storage = memoryStorage('not-a-uuid');
    const key = quoteCreateIdempotencyKeyForVisit(
      visitInput(storage, { createId: () => '66666666-6666-4666-8666-666666666666' }),
    );
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
