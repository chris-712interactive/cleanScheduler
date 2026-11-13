export const FOLLOW_UP_STATES = ['pending', 'ok', 'failed', 'skipped', 'unknown'] as const;

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

/**
 * The HTTP action stops waiting after this. The provider call may still be
 * running. That outcome is `unknown`, not a failure that another instance can claim.
 */
export const CHANNEL_SEND_TIMEOUT_MS = 45_000;

/**
 * How long a timed-out provider call stays unclaimable. Longer than the 45s wait
 * and longer than a provider HTTP call can still deliver (webhook attempts use
 * 15s; hung email or SMS clients are bounded by the platform, well under this).
 */
export const CHANNEL_SEND_LEASE_MS = 15 * 60 * 1000;

export type QuoteChannel = 'email' | 'sms' | 'webhook';

/** Same key for every claim of this step so the provider can collapse a retry. */
export function quoteChannelProviderKey(channel: QuoteChannel, quoteId: string): string {
  return `quote-${channel}-${quoteId}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 255);
}

let channelSendTimeoutOverrideMs: number | null = null;

export function channelSendTimeoutMs(): number {
  return channelSendTimeoutOverrideMs ?? CHANNEL_SEND_TIMEOUT_MS;
}

/** Tests only. Pass null to use {@link CHANNEL_SEND_TIMEOUT_MS}. */
export function setChannelSendTimeoutMsForTests(ms: number | null): void {
  channelSendTimeoutOverrideMs = ms;
}

export type QuoteCreateFollowUpRecord = QuoteCreateFollowUps & {
  claimedAt: Partial<Record<keyof QuoteCreateFollowUps, string>>;
  claimToken: Partial<Record<keyof QuoteCreateFollowUps, string>>;
  /** When an `unknown` channel may be claimed again. Missing means not yet. */
  unknownUntil: Partial<Record<keyof QuoteCreateFollowUps, string>>;
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
    unknownUntil: followUpClock(record.unknownUntil),
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

/**
 * An unknown channel stays quiet until `unknownUntil`. A missing clock is not
 * retryable: the provider call may still deliver.
 */
export function isUnknownExpired(
  followUps: QuoteCreateFollowUpRecord,
  step: keyof QuoteCreateFollowUps,
  nowMs: number,
): boolean {
  if (followUps[step] !== 'unknown') return false;
  const until = followUps.unknownUntil[step];
  if (!until) return false;
  const untilMs = Date.parse(until);
  if (!Number.isFinite(untilMs)) return false;
  return nowMs >= untilMs;
}

export function hasUnsettledFollowUp(followUps: QuoteCreateFollowUps): boolean {
  return FOLLOW_UP_KEYS.some((key) => followUps[key] === 'pending' || followUps[key] === 'unknown');
}

/** Failed steps, stale pending steps, and unknown steps whose cooldown has elapsed. */
export function retryableFollowUpSteps(
  followUps: QuoteCreateFollowUpRecord,
  nowMs: number,
): (keyof QuoteCreateFollowUps)[] {
  return FOLLOW_UP_KEYS.filter(
    (step) =>
      followUps[step] === 'failed' ||
      isUnknownExpired(followUps, step, nowMs) ||
      isStalePending(followUps, step, nowMs),
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

const HISTORY_VISIT_FIELD = 'csQuoteCreateVisit';

/** History state id for this wizard entry. A new quote visit does not carry it. */
export function readQuoteCreateHistoryVisitId(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const id = (state as Record<string, unknown>)[HISTORY_VISIT_FIELD];
  return typeof id === 'string' && IDEMPOTENCY_KEY_RE.test(id) ? id : null;
}

export function withQuoteCreateHistoryVisit(
  state: unknown,
  visitId: string,
): Record<string, unknown> {
  const base =
    state && typeof state === 'object' && !Array.isArray(state)
      ? { ...(state as Record<string, unknown>) }
      : {};
  return { ...base, [HISTORY_VISIT_FIELD]: visitId };
}

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
 * Reuse the key for a reload of this wizard path, or when `historyVisitId` is
 * the same history entry that stored the key. Any other visit mints a new key.
 * `navigationPath` is the document that was loaded, which stays put after that load.
 */
export function quoteCreateIdempotencyKeyForVisit(input: {
  storage: IdempotencyKeyStorage;
  navigationType: string;
  navigationPath: string;
  currentPath: string;
  laterVisitInDocument: boolean;
  historyVisitId: string | null;
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
    const sameHistoryEntry = Boolean(
      sameWizard && input.historyVisitId && stored && input.historyVisitId === stored.key,
    );
    if (stored && (reloadOfThisWizard || sameHistoryEntry)) return stored.key;
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

/** Test hook. Production visits do not need to reset this. */
export function resetQuoteCreateVisitMemory() {
  quoteCreateNavigationClaimed = false;
  quoteCreateLastDecisionAt = 0;
  quoteCreateLastDecisionKey = '';
}

const liveChannelSends = new Set<string>();

function channelLeaseId(idempotencyKey: string, step: string): string {
  return `${idempotencyKey}:${step}`;
}

/** Same-instance guard while a provider call is still unsettled, including after we stop waiting. */
export function quoteChannelLeaseHeld(idempotencyKey: string, step: string): boolean {
  return liveChannelSends.has(channelLeaseId(idempotencyKey, step));
}

export function tryAcquireQuoteChannelLease(idempotencyKey: string, step: string): boolean {
  const id = channelLeaseId(idempotencyKey, step);
  if (liveChannelSends.has(id)) return false;
  liveChannelSends.add(id);
  return true;
}

export function releaseQuoteChannelLease(idempotencyKey: string, step: string): void {
  liveChannelSends.delete(channelLeaseId(idempotencyKey, step));
}

export function resetQuoteChannelSendLeases(): void {
  liveChannelSends.clear();
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
  historyVisitId?: string | null;
}): string {
  const nowMs = input.nowMs ?? Date.now();
  const currentPath =
    input.currentPath ?? (typeof window === 'undefined' ? '' : window.location.pathname);
  const navigation = readQuoteCreateDocumentNavigation();
  const navigationType = input.navigationType ?? navigation.type;
  const navigationPath = input.navigationPath ?? navigation.path;
  const historyVisitId =
    input.historyVisitId === undefined && typeof window !== 'undefined'
      ? readQuoteCreateHistoryVisitId(window.history.state)
      : (input.historyVisitId ?? null);
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
  const key = quoteCreateIdempotencyKeyForVisit({
    storage: input.storage,
    navigationType,
    navigationPath,
    currentPath,
    laterVisitInDocument: quoteCreateNavigationClaimed,
    historyVisitId,
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
