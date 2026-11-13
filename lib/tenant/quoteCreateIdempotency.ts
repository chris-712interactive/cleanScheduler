export const FOLLOW_UP_STATES = ['pending', 'ok', 'failed', 'skipped'] as const;

export type FollowUpState = (typeof FOLLOW_UP_STATES)[number];

export type QuoteCreateFollowUps = {
  entryCodes: FollowUpState;
  locationFacts: FollowUpState;
  locationKind: FollowUpState;
  crew: FollowUpState;
  promotions: FollowUpState;
  email: FollowUpState;
  sms: FollowUpState;
  webhook: FollowUpState;
};

const FOLLOW_UP_KEYS = [
  'entryCodes',
  'locationFacts',
  'locationKind',
  'crew',
  'promotions',
  'email',
  'sms',
  'webhook',
] as const satisfies readonly (keyof QuoteCreateFollowUps)[];

export function initialFollowUps(send: boolean): QuoteCreateFollowUps {
  const delivery: FollowUpState = send ? 'pending' : 'skipped';
  return {
    entryCodes: 'pending',
    locationFacts: 'pending',
    locationKind: 'pending',
    crew: 'pending',
    promotions: 'pending',
    email: delivery,
    sms: delivery,
    webhook: delivery,
  };
}

function isState(value: unknown): value is FollowUpState {
  return typeof value === 'string' && (FOLLOW_UP_STATES as readonly string[]).includes(value);
}

/** Unknown or missing steps are skipped so a replay does not invent work. */
export function readFollowUps(value: unknown): QuoteCreateFollowUps {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const followUps = initialFollowUps(false);
  for (const key of FOLLOW_UP_KEYS) {
    followUps[key] = isState(record[key]) ? record[key] : 'skipped';
  }
  return followUps;
}

export function failedFollowUpKeys(
  followUps: QuoteCreateFollowUps,
): (keyof QuoteCreateFollowUps)[] {
  return FOLLOW_UP_KEYS.filter((key) => followUps[key] === 'failed');
}

export function hasPendingFollowUp(followUps: QuoteCreateFollowUps): boolean {
  return FOLLOW_UP_KEYS.some((key) => followUps[key] === 'pending');
}

/** sessionStorage slot for the quote wizard's current visit. Cleared after a successful create. */
export const QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY = 'cleanscheduler.quoteCreate.idempotencyKey';

const IDEMPOTENCY_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IdempotencyKeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Document navigation type. A full reload is `reload`; a new wizard visit is not. */
export function readQuoteCreateNavigationType(): string {
  try {
    const entry = performance.getEntriesByType('navigation')[0];
    if (entry && 'type' in entry && typeof entry.type === 'string') return entry.type;
  } catch {
    // performance is unavailable; treat this mount as a new visit.
  }
  return 'navigate';
}

/**
 * One UUID per wizard visit. A reload of that visit reuses the stored key so a
 * lost response cannot mint a second key. Any other visit replaces it.
 */
export function quoteCreateIdempotencyKeyForVisit(input: {
  storage: IdempotencyKeyStorage;
  navigationType: string;
  createId: () => string;
}): string {
  let created = '';
  try {
    if (input.navigationType === 'reload') {
      const existing = input.storage.getItem(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY);
      if (existing && IDEMPOTENCY_KEY_RE.test(existing)) return existing;
    }
    created = input.createId();
    input.storage.setItem(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY, created);
    return created;
  } catch {
    return created || input.createId();
  }
}

export function clearQuoteCreateIdempotencyKey(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY);
  } catch {
    // Private mode can throw. This visit still has the in-memory key.
  }
}

/**
 * Synchronous in-flight guard. The first call claims the lock; a second call
 * in the same turn, before React re-renders, returns false.
 */
export function claimQuoteSubmit(lock: { held: boolean }): boolean {
  if (lock.held) return false;
  lock.held = true;
  return true;
}
