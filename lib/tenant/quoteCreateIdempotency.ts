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

export const FOLLOW_UP_KEYS = [
  'entryCodes',
  'locationFacts',
  'locationKind',
  'crew',
  'promotions',
  'email',
  'sms',
  'webhook',
] as const satisfies readonly (keyof QuoteCreateFollowUps)[];

/** A pending step older than this is treated as abandoned and can be claimed again. */
export const STALE_FOLLOW_UP_MS = 3 * 60 * 1000;

export type QuoteCreateFollowUpRecord = QuoteCreateFollowUps & {
  claimedAt: Partial<Record<keyof QuoteCreateFollowUps, string>>;
  claimToken: Partial<Record<keyof QuoteCreateFollowUps, string>>;
};

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

function followUpClock(value: unknown): Partial<Record<keyof QuoteCreateFollowUps, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const clock: Partial<Record<keyof QuoteCreateFollowUps, string>> = {};
  for (const key of FOLLOW_UP_KEYS) {
    const at = (value as Record<string, unknown>)[key];
    if (typeof at === 'string' && at) clock[key] = at;
  }
  return clock;
}

/** Step states plus the claim clock stored beside them. Unknown step values stay skipped. */
export function readFollowUpRecord(value: unknown): QuoteCreateFollowUpRecord {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    ...readFollowUps(value),
    claimedAt: followUpClock(record.claimedAt),
    claimToken: followUpClock(record.claimToken),
  };
}

export function isStalePending(
  followUps: QuoteCreateFollowUpRecord,
  step: keyof QuoteCreateFollowUps,
  nowMs: number,
): boolean {
  if (followUps[step] !== 'pending') return false;
  const at = followUps.claimedAt[step];
  if (!at) return true;
  const claimedMs = Date.parse(at);
  if (!Number.isFinite(claimedMs)) return true;
  return nowMs - claimedMs >= STALE_FOLLOW_UP_MS;
}

/** Failed steps, and pending steps whose claim is missing or older than the stale window. */
export function retryableFollowUpSteps(
  followUps: QuoteCreateFollowUpRecord,
  nowMs: number,
): (keyof QuoteCreateFollowUps)[] {
  return FOLLOW_UP_KEYS.filter(
    (step) => followUps[step] === 'failed' || isStalePending(followUps, step, nowMs),
  );
}

/** A late writer must not replace `ok`, and must not finish a step another claim owns. */
export function followUpWriteAllowed(
  followUps: QuoteCreateFollowUpRecord,
  step: keyof QuoteCreateFollowUps,
  nextState: FollowUpState,
  ownerToken: string,
): boolean {
  if (followUps[step] === 'ok' && nextState !== 'ok') return false;
  const owner = followUps.claimToken[step];
  if (owner && owner !== ownerToken) return false;
  return true;
}

/** sessionStorage slot for the quote wizard's current visit. Cleared after a successful create. */
export const QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY = 'cleanscheduler.quoteCreate.idempotencyKey';

const IDEMPOTENCY_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const QUOTE_IN_FLIGHT_CODE = 'quote-in-flight';

type IdempotencyKeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StoredQuoteCreateVisit = {
  key: string;
  path: string;
  submitted: boolean;
};

/** True when the saved quote still has a step in flight, so a reload must keep this key. */
export function quoteCreateWarningKeepsIdempotencyKey(warning: string | undefined): boolean {
  if (!warning) return false;
  return warning.split(',').some((part) => part.trim() === QUOTE_IN_FLIGHT_CODE);
}

function readStoredVisit(
  storage: Pick<Storage, 'getItem'>,
  currentPath: string,
): StoredQuoteCreateVisit | null {
  let raw = '';
  try {
    raw = storage.getItem(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY) ?? '';
  } catch {
    return null;
  }
  if (!raw) return null;
  if (IDEMPOTENCY_KEY_RE.test(raw)) {
    return { key: raw, path: currentPath, submitted: true };
  }
  try {
    const parsed = JSON.parse(raw) as { key?: unknown; path?: unknown; submitted?: unknown };
    if (typeof parsed.key === 'string' && IDEMPOTENCY_KEY_RE.test(parsed.key)) {
      return {
        key: parsed.key,
        path: typeof parsed.path === 'string' ? parsed.path : '',
        submitted: parsed.submitted === true,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredVisit(storage: IdempotencyKeyStorage, visit: StoredQuoteCreateVisit) {
  storage.setItem(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY, JSON.stringify(visit));
}

/**
 * Reuse the key only for a reload or Back of this wizard path after a submit.
 * A later client-side visit in the same document mints a new key. `navigationPath`
 * is the document that was loaded, which stays put after that load.
 */
export function quoteCreateIdempotencyKeyForVisit(input: {
  storage: IdempotencyKeyStorage;
  navigationType: string;
  navigationPath: string;
  currentPath: string;
  laterVisitInDocument: boolean;
  backForward: boolean;
  createId: () => string;
}): string {
  let created = '';
  try {
    const stored = readStoredVisit(input.storage, input.currentPath);
    const sameWizard =
      Boolean(stored?.submitted) && stored?.path === input.currentPath && Boolean(stored?.key);
    const reloadOfThisWizard =
      !input.laterVisitInDocument &&
      input.navigationType === 'reload' &&
      input.navigationPath === input.currentPath &&
      sameWizard;
    const backOfThisWizard =
      sameWizard &&
      (input.backForward ||
        (!input.laterVisitInDocument &&
          input.navigationType === 'back_forward' &&
          input.navigationPath === input.currentPath));
    if (stored && (reloadOfThisWizard || backOfThisWizard)) return stored.key;
    created = input.createId();
    writeStoredVisit(input.storage, {
      key: created,
      path: input.currentPath,
      submitted: false,
    });
    return created;
  } catch {
    return created || input.createId();
  }
}

export function markQuoteCreateIdempotencySubmitted(
  storage: IdempotencyKeyStorage,
  currentPath: string,
): void {
  try {
    const stored = readStoredVisit(storage, currentPath);
    if (!stored) return;
    writeStoredVisit(storage, { ...stored, path: stored.path || currentPath, submitted: true });
  } catch {
    // The in-memory key still covers this attempt if storage is blocked.
  }
}

export function clearQuoteCreateIdempotencyKey(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(QUOTE_CREATE_IDEMPOTENCY_STORAGE_KEY);
  } catch {
    // Private mode can throw. This visit still has the in-memory key.
  }
}

let quoteCreateNavigationClaimed = false;
let quoteCreateLastDecisionAt = 0;
let quoteCreateLastDecisionKey = '';
let quoteCreateBackForwardAt = 0;

/** Test hook. Production visits do not need to reset this. */
export function resetQuoteCreateVisitMemory() {
  quoteCreateNavigationClaimed = false;
  quoteCreateLastDecisionAt = 0;
  quoteCreateLastDecisionKey = '';
  quoteCreateBackForwardAt = 0;
}

export function noteQuoteCreateBackForward(nowMs = Date.now()) {
  quoteCreateBackForwardAt = nowMs;
}

function consumeRecentBackForward(nowMs: number): boolean {
  const recent = quoteCreateBackForwardAt > 0 && nowMs - quoteCreateBackForwardAt < 3000;
  quoteCreateBackForwardAt = 0;
  return recent;
}

function ensureQuoteCreateNavigationListeners() {
  if (typeof window === 'undefined') return;
  const marked = window as Window & { __csQuoteCreateNav?: boolean };
  if (marked.__csQuoteCreateNav) return;
  marked.__csQuoteCreateNav = true;
  window.addEventListener('popstate', () => noteQuoteCreateBackForward());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) noteQuoteCreateBackForward();
  });
}

export function readQuoteCreateDocumentNavigation(): { type: string; path: string } {
  try {
    const entry = performance.getEntriesByType('navigation')[0];
    if (entry && 'type' in entry && typeof entry.type === 'string') {
      let path = '';
      try {
        path = new URL(entry.name).pathname;
      } catch {
        path = '';
      }
      return { type: entry.type, path };
    }
  } catch {
    // performance is unavailable; treat this mount as a new visit.
  }
  return { type: 'navigate', path: '' };
}

/**
 * Wizard entry. A strict-mode remount within the same decision returns the key
 * just chosen. A later mount mints a new key unless this navigation is Back.
 */
export function resolveQuoteCreateIdempotencyKey(input: {
  storage: IdempotencyKeyStorage;
  createId: () => string;
  nowMs?: number;
  navigationType?: string;
  navigationPath?: string;
  currentPath?: string;
}): string {
  ensureQuoteCreateNavigationListeners();
  const nowMs = input.nowMs ?? Date.now();
  const currentPath =
    input.currentPath ?? (typeof window === 'undefined' ? '' : window.location.pathname);
  const navigation = readQuoteCreateDocumentNavigation();
  const navigationType = input.navigationType ?? navigation.type;
  const navigationPath = input.navigationPath ?? navigation.path;
  let stored: StoredQuoteCreateVisit | null = null;
  try {
    stored = readStoredVisit(input.storage, currentPath);
  } catch {
    stored = null;
  }
  if (
    quoteCreateNavigationClaimed &&
    nowMs - quoteCreateLastDecisionAt < 300 &&
    stored?.key === quoteCreateLastDecisionKey
  ) {
    quoteCreateLastDecisionAt = nowMs;
    return quoteCreateLastDecisionKey;
  }
  const backForward = consumeRecentBackForward(nowMs);
  const key = quoteCreateIdempotencyKeyForVisit({
    storage: input.storage,
    navigationType,
    navigationPath,
    currentPath,
    laterVisitInDocument: quoteCreateNavigationClaimed,
    backForward,
    createId: input.createId,
  });
  quoteCreateNavigationClaimed = true;
  quoteCreateLastDecisionAt = nowMs;
  quoteCreateLastDecisionKey = key;
  return key;
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
