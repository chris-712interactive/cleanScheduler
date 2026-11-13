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

/**
 * Synchronous in-flight guard. The first call claims the lock; a second call
 * in the same turn, before React re-renders, returns false.
 */
export function claimQuoteSubmit(lock: { held: boolean }): boolean {
  if (lock.held) return false;
  lock.held = true;
  return true;
}
