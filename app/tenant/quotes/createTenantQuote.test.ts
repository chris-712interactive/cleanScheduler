import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTRY_CODE_SAVE_WARNING, quoteSaveNotice } from '@/lib/tenant/quoteStructuredFields';

const QUOTE_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const PROPERTY_ID = '33333333-3333-4333-8333-333333333333';
const GATE_CODE = '4412';
const KEY = '44444444-4444-4444-8444-444444444444';
const OTHER_KEY = '55555555-5555-4555-8555-555555555555';

const harness = vi.hoisted(() => {
  const state = {
    rpcCalls: 0,
    quoteStatus: 'draft',
    isLocked: false,
    codeFailuresLeft: 0,
    codeThrows: false,
    emailOk: true,
    smsOk: true,
    webhookOk: true,
    quoteLookupError: false,
    quoteTitle: 'Weekly clean',
    claimError: null as { code: string; message: string } | null,
    leaseClaimError: null as { code: string; message: string } | null,
    failFollowUpCommits: false,
  };
  const requests = new Map<
    string,
    { quote_id: string | null; follow_ups: Record<string, unknown> }
  >();
  const leases = new Map<
    string,
    {
      state: string;
      owner_token: string;
      provider_key: string;
      lease_expires_at: string;
    }
  >();
  const saveCodes = vi.fn(
    async (
      _admin: unknown,
      _tenantId: string,
      _propertyId: string,
      codes: { gateCode: string },
    ) => {
      if (state.codeThrows) {
        state.codeThrows = false;
        throw new Error(`key missing while saving ${codes.gateCode}`);
      }
      if (state.codeFailuresLeft > 0) {
        state.codeFailuresLeft -= 1;
        return { ok: false as const, error: `could not store ${codes.gateCode}` };
      }
      return { ok: true as const };
    },
  );
  const sendEmail = vi.fn(
    async (input?: { quoteTitle?: string; customerId?: string; idempotencyKey?: string }) => {
      void input;
      return { ok: state.emailOk };
    },
  );
  const sendSms = vi.fn(
    async (input?: { quoteTitle?: string; customerId?: string; idempotencyKey?: string }) => {
      void input;
      return { ok: state.smsOk };
    },
  );
  const emitWebhook = vi.fn(
    async (input?: { quoteTitle?: string; customerId?: string; eventId?: string }) => {
      void input;
      return { ok: state.webhookOk };
    },
  );

  function seedRequest(
    key: string,
    row: { quote_id: string | null; follow_ups: Record<string, unknown> },
  ) {
    requests.set(`tenant-1:${key}`, row);
  }

  function seedLease(
    key: string,
    channel: string,
    row: {
      state: string;
      owner_token: string;
      provider_key: string;
      lease_expires_at: string;
    },
  ) {
    leases.set(`tenant-1:${key}:${channel}`, { ...row });
  }

  function claimLease(args: Record<string, string>) {
    const owner = args.p_owner_token ?? '';
    const providerKey = args.p_provider_key ?? '';
    const leaseExpiresAt = args.p_lease_expires_at ?? '';
    const id = `${args.p_tenant_id}:${args.p_idempotency_key}:${args.p_channel}`;
    const now = Date.now();
    const expiryMs = Date.parse(leaseExpiresAt);
    const row = leases.get(id);
    if (!Number.isFinite(expiryMs) || expiryMs <= now) {
      if (!row) {
        return { claimed: false, provider_key: null, state: null, lease_expires_at: null };
      }
      return {
        claimed: false,
        provider_key: row.provider_key,
        state: row.state,
        lease_expires_at: row.lease_expires_at,
      };
    }
    if (!row) {
      const created = {
        state: 'sending',
        owner_token: owner,
        provider_key: providerKey,
        lease_expires_at: leaseExpiresAt,
      };
      leases.set(id, created);
      return {
        claimed: true,
        provider_key: created.provider_key,
        state: 'sending',
        lease_expires_at: created.lease_expires_at,
      };
    }
    if (
      row.owner_token === owner &&
      row.state === 'sending' &&
      Date.parse(row.lease_expires_at) > now
    ) {
      return {
        claimed: true,
        provider_key: row.provider_key,
        state: row.state,
        lease_expires_at: row.lease_expires_at,
      };
    }
    const expired = Date.parse(row.lease_expires_at) <= now;
    if (
      row.state === 'failed' ||
      ((row.state === 'sending' || row.state === 'unknown') && expired)
    ) {
      row.state = 'sending';
      row.owner_token = owner;
      row.lease_expires_at = leaseExpiresAt;
      return {
        claimed: true,
        provider_key: row.provider_key,
        state: 'sending',
        lease_expires_at: row.lease_expires_at,
      };
    }
    return {
      claimed: false,
      provider_key: row.provider_key,
      state: row.state,
      lease_expires_at: row.lease_expires_at,
    };
  }

  function leaseQuery() {
    const filters: Record<string, unknown> = {};
    let payload: Record<string, unknown> | null = null;
    const api = {
      select() {
        return api;
      },
      update(row: Record<string, unknown>) {
        payload = row;
        return api;
      },
      eq(column: string, value: string) {
        filters[column] = value;
        return api;
      },
      in(column: string, values: string[]) {
        filters[column] = values;
        return api;
      },
      maybeSingle: () => Promise.resolve(run()),
    };
    return api;

    function run() {
      const id = `${String(filters.tenant_id)}:${String(filters.idempotency_key)}:${String(filters.channel)}`;
      const row = leases.get(id);
      if (!row || !payload) return { data: null, error: null };
      if (filters.owner_token && row.owner_token !== filters.owner_token) {
        return { data: null, error: null };
      }
      const stateFilter = filters.state;
      if (Array.isArray(stateFilter) && !stateFilter.includes(row.state)) {
        return { data: null, error: null };
      }
      if (typeof stateFilter === 'string' && row.state !== stateFilter) {
        return { data: null, error: null };
      }
      if (typeof payload.state === 'string') row.state = payload.state;
      if (typeof payload.lease_expires_at === 'string') {
        row.lease_expires_at = payload.lease_expires_at;
      }
      return { data: { channel: row.state }, error: null };
    }
  }

  function sameJson(left: unknown, right: unknown): boolean {
    const stable = (value: unknown): string => {
      if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
          .join(',')}}`;
      }
      return JSON.stringify(value) ?? 'null';
    };
    return stable(left) === stable(right);
  }

  function requestQuery() {
    const filters: Record<string, unknown> = {};
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: {
      tenant_id?: string;
      idempotency_key?: string;
      quote_id?: string;
      follow_ups?: Record<string, unknown>;
    } | null = null;
    const api = {
      select() {
        return api;
      },
      insert(row: typeof payload) {
        op = 'insert';
        payload = row;
        return api;
      },
      update(row: typeof payload) {
        op = 'update';
        payload = row;
        return api;
      },
      delete() {
        op = 'delete';
        return api;
      },
      eq(column: string, value: string) {
        filters[column] = value;
        return api;
      },
      filter(column: string, operator: string, value: unknown) {
        if (operator === 'eq') filters[column] = value;
        return api;
      },
      maybeSingle: () => Promise.resolve(run()),
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(onFulfilled, onRejected);
      },
    };
    return api;

    function run() {
      const id = `${String(filters.tenant_id ?? payload?.tenant_id ?? 'tenant-1')}:${String(filters.idempotency_key ?? payload?.idempotency_key ?? '')}`;
      if (op === 'insert') {
        if (state.claimError) return { data: null, error: state.claimError };
        if (requests.has(id))
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        const row = {
          quote_id: null,
          follow_ups: payload?.follow_ups ?? {},
        };
        requests.set(id, row);
        return { data: row, error: null };
      }
      if (op === 'update') {
        const row = requests.get(id);
        if (!row) return { data: null, error: { message: 'missing' } };
        if (typeof filters.follow_ups === 'string') {
          let expected: unknown = filters.follow_ups;
          try {
            expected = JSON.parse(filters.follow_ups);
          } catch {
            expected = filters.follow_ups;
          }
          if (!sameJson(row.follow_ups, expected)) return { data: null, error: null };
        }
        const stepFilter = Object.keys(filters).find((key) => key.startsWith('follow_ups->>'));
        if (stepFilter) {
          const step = stepFilter.slice('follow_ups->>'.length);
          if (row.follow_ups[step] !== filters[stepFilter]) return { data: null, error: null };
        }
        if (state.failFollowUpCommits && payload?.follow_ups && stepFilter) {
          const step = stepFilter.slice('follow_ups->>'.length);
          const next = payload.follow_ups[step];
          if (next === 'ok' || next === 'failed') return { data: null, error: null };
        }
        if (payload?.quote_id) row.quote_id = payload.quote_id;
        if (payload?.follow_ups) row.follow_ups = payload.follow_ups;
        return { data: { idempotency_key: String(filters.idempotency_key ?? '') }, error: null };
      }
      if (op === 'delete') {
        requests.delete(id);
        return { error: null };
      }
      return { data: requests.get(id) ?? null, error: null };
    }
  }

  function createMockAdmin() {
    return {
      from(table: string) {
        if (table === 'tenant_quote_create_requests') return requestQuery();
        if (table === 'tenant_quote_channel_sends') return leaseQuery();
        return query(table);
      },
      async rpc(name: string, args: Record<string, string>) {
        if (name === 'claim_quote_channel_send') {
          if (state.leaseClaimError) return { data: null, error: state.leaseClaimError };
          return { data: claimLease(args), error: null };
        }
        if (name !== 'tenant_quote_create_with_line_items') {
          return { data: null, error: { message: 'unexpected rpc' } };
        }
        state.rpcCalls += 1;
        state.quoteStatus = args.p_status ?? 'draft';
        return { data: QUOTE_ID, error: null };
      },
    };
  }

  function query(table: string) {
    const mode: { head: boolean } = { head: false };
    const api = {
      select(_columns?: string, options?: { head?: boolean }) {
        mode.head = Boolean(options?.head);
        return api;
      },
      insert() {
        return api;
      },
      update() {
        return api;
      },
      eq() {
        return api;
      },
      neq() {
        return api;
      },
      not() {
        return api;
      },
      is() {
        return api;
      },
      order() {
        return api;
      },
      maybeSingle: () => Promise.resolve(row(table, true)),
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(row(table, false)).then(onFulfilled, onRejected);
      },
    };
    return api;

    function row(current: string, single: boolean) {
      if (mode.head) return { data: null, error: null, count: 1 };
      if (current === 'customers') {
        return {
          data: { id: CUSTOMER_ID, imported_at: '2024-01-01T00:00:00.000Z', status: 'active' },
          error: null,
          count: 1,
        };
      }
      if (current === 'tenant_customer_properties') {
        const property = {
          id: PROPERTY_ID,
          property_kind: 'residential',
          sqft: 1200,
          label: 'Home',
          customer_id: CUSTOMER_ID,
          consultation_requested_at: null,
        };
        return { data: single ? property : [property], error: null, count: 1 };
      }
      if (current === 'tenant_quotes') {
        if (state.quoteLookupError)
          return { data: null, error: { message: 'lookup failed' }, count: 0 };
        const quote = {
          id: QUOTE_ID,
          status: state.quoteStatus,
          customer_id: CUSTOMER_ID,
          property_id: PROPERTY_ID,
          title: state.quoteTitle,
          is_locked: state.isLocked,
        };
        return { data: single ? quote : [quote], error: null, count: 1 };
      }
      if (current === 'tenant_operational_settings') {
        return {
          data: { service_segment: 'both', require_consultation_before_quote: false },
          error: null,
          count: 1,
        };
      }
      if (current === 'tenant_quote_pipeline_stages') {
        return { data: single ? { id: 'stage-1' } : [{ id: 'stage-1' }], error: null, count: 1 };
      }
      return { data: single ? null : [], error: null, count: 0 };
    }
  }

  return {
    state,
    requests,
    leases,
    seedRequest,
    seedLease,
    saveCodes,
    sendEmail,
    sendSms,
    emitWebhook,
    createMockAdmin,
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

vi.mock('@/lib/auth/tenantAccess', () => ({
  requireTenantPortalAccess: async () => ({
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    role: 'owner',
    roleId: null,
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => harness.createMockAdmin(),
}));

vi.mock('@/lib/security/propertyAccessCodeCrypto', () => ({
  savePropertyAccessCodes: (
    admin: unknown,
    tenantId: string,
    propertyId: string,
    codes: { gateCode: string },
  ) => harness.saveCodes(admin, tenantId, propertyId, codes),
}));

vi.mock('@/lib/tenant/quoteNotifications', () => ({
  sendQuoteNotificationEmail: (_admin: unknown, _event: unknown, input: unknown) =>
    harness.sendEmail(input as { quoteTitle?: string; customerId?: string }),
}));

vi.mock('@/lib/sms/quoteNotificationSms', () => ({
  sendQuoteNotificationSms: (_admin: unknown, _event: unknown, input: unknown) =>
    harness.sendSms(input as { quoteTitle?: string; customerId?: string }),
}));

vi.mock('@/lib/integrations/emitQuoteWebhook', () => ({
  emitQuoteWebhookEvent: (_admin: unknown, _event: unknown, input: unknown) =>
    harness.emitWebhook(input as { quoteTitle?: string; customerId?: string }),
}));

vi.mock('@/lib/portal/invalidatePortalCache', () => ({
  invalidateCustomerQuoteBadge: () => {},
}));

import {
  resetQuoteChannelSendLeases,
  setChannelSendTimeoutMsForTests,
} from '@/lib/tenant/quoteCreateIdempotency';
import { createTenantQuote, type QuoteFormState } from './actions';

function withPendingClaim(followUps: Record<string, string>, ageMs = 0): Record<string, unknown> {
  const claimedAt: Record<string, string> = {};
  const claimToken: Record<string, string> = {};
  const at = new Date(Date.now() - ageMs).toISOString();
  for (const [step, state] of Object.entries(followUps)) {
    if (state !== 'pending') continue;
    claimedAt[step] = at;
    claimToken[step] = 'live-request';
  }
  return { ...followUps, claimedAt, claimToken };
}

function quoteForm(intent: 'draft' | 'send', key = KEY): FormData {
  const form = new FormData();
  form.set('tenant_slug', 'acme');
  form.set('create_idempotency_key', key);
  form.set('title', 'Weekly clean');
  form.set('customer_source', 'existing');
  form.set('property_source', 'existing');
  form.set('customer_id', CUSTOMER_ID);
  form.set('property_id', PROPERTY_ID);
  form.set('save_intent', intent);
  form.set('scope_inclusions', '[]');
  form.set('quote_property_kind', 'residential');
  form.set('quote_property_stories', '2');
  form.set('line_service', 'Standard clean');
  form.set('line_frequency', 'one_time');
  form.set('line_amount', '150');
  form.set('save_access_codes', '1');
  form.set('gate_code', GATE_CODE);
  form.set('door_code', '19');
  if (intent === 'send') form.set('valid_until', '2026-12-01');
  return form;
}

describe('createTenantQuote follow-up failures', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    harness.state.rpcCalls = 0;
    harness.state.quoteStatus = 'draft';
    harness.state.isLocked = false;
    harness.state.codeFailuresLeft = 0;
    harness.state.codeThrows = false;
    harness.state.emailOk = true;
    harness.state.smsOk = true;
    harness.state.webhookOk = true;
    harness.state.quoteLookupError = false;
    harness.state.quoteTitle = 'Weekly clean';
    harness.state.claimError = null;
    harness.state.leaseClaimError = null;
    harness.state.failFollowUpCommits = false;
    resetQuoteChannelSendLeases();
    setChannelSendTimeoutMsForTests(null);
    harness.requests.clear();
    harness.leases.clear();
    harness.saveCodes.mockClear();
    harness.sendEmail.mockClear();
    harness.sendSms.mockClear();
    harness.emitWebhook.mockClear();
    errorSpy.mockClear();
  });

  it('returns the saved quote with no warning when entry codes store successfully', async () => {
    const result = await createTenantQuote({}, quoteForm('draft'));

    expect(result).toEqual({ success: true, quoteId: QUOTE_ID });
    expect(result.error).toBeUndefined();
    expect(result.warning).toBeUndefined();
    expect(harness.state.rpcCalls).toBe(1);
    expect(harness.saveCodes).toHaveBeenCalledTimes(1);
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns quoteId and a warning when entry codes fail after the quote exists, and still sends', async () => {
    harness.state.codeFailuresLeft = 1;

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result.success).toBe(true);
    expect(result.quoteId).toBe(QUOTE_ID);
    expect(result.error).toBeUndefined();
    expect(result.warning).toBe('entry-codes');
    expect(quoteSaveNotice(result.warning)).toBe(ENTRY_CODE_SAVE_WARNING);
    expect(JSON.stringify(result)).not.toContain(GATE_CODE);
    expect(quoteSaveNotice(result.warning)).not.toContain(GATE_CODE);
    expect(harness.state.rpcCalls).toBe(1);
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.emitWebhook).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(GATE_CODE);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('PROPERTY_ACCESS_CODE_KEY');
  });

  it('does not create a duplicate quote when the same form is submitted again', async () => {
    harness.state.codeFailuresLeft = 1;
    const first = await createTenantQuote({}, quoteForm('send'));
    expect(first.quoteId).toBe(QUOTE_ID);

    const retry = await createTenantQuote(first, quoteForm('send'));

    expect(retry).toEqual({ success: true, quoteId: QUOTE_ID });
    expect(harness.state.rpcCalls).toBe(1);
    expect(harness.saveCodes).toHaveBeenCalledTimes(2);
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.emitWebhook).toHaveBeenCalledTimes(1);
  });

  it('still returns the quote when storing entry codes throws', async () => {
    harness.state.codeThrows = true;
    const result: QuoteFormState = await createTenantQuote({}, quoteForm('draft'));

    expect(result).toEqual({
      success: true,
      quoteId: QUOTE_ID,
      warning: 'entry-codes',
    });
    expect(JSON.stringify(result)).not.toContain(GATE_CODE);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(GATE_CODE);
    expect(harness.state.rpcCalls).toBe(1);
  });

  it('does not send or rewrite an accepted quote bound to this save key', async () => {
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'failed',
        email: 'failed',
        sms: 'ok',
        webhook: 'ok',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
      },
    });
    harness.state.quoteStatus = 'accepted';
    harness.state.isLocked = true;

    const result = await createTenantQuote(
      { quoteId: QUOTE_ID, warning: 'quote-notify' },
      quoteForm('send'),
    );

    expect(result.success).toBe(true);
    expect(result.quoteId).toBe(QUOTE_ID);
    expect(result.warning).toBe('entry-codes,quote-notify');
    expect(quoteSaveNotice(result.warning)).not.toContain('location or crew');
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.state.quoteStatus).toBe('accepted');
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.sendSms).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
    expect(harness.saveCodes).not.toHaveBeenCalled();
  });

  it('ignores a client quote id when the save key is new', async () => {
    harness.state.quoteStatus = 'accepted';
    harness.state.isLocked = true;

    await createTenantQuote(
      { quoteId: QUOTE_ID, warning: 'quote-notify' },
      quoteForm('send', OTHER_KEY),
    );

    expect(harness.state.rpcCalls).toBe(1);
  });

  it('does not resend a channel the server already marked successful', async () => {
    const first = await createTenantQuote({ warning: 'quote-notify' }, quoteForm('send'));
    expect(first.quoteId).toBe(QUOTE_ID);
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);

    const retry = await createTenantQuote(
      { quoteId: '99999999-9999-4999-8999-999999999999', warning: 'quote-notify' },
      quoteForm('send'),
    );

    expect(retry.quoteId).toBe(QUOTE_ID);
    expect(retry.warning).toBeUndefined();
    expect(harness.state.rpcCalls).toBe(1);
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.emitWebhook).toHaveBeenCalledTimes(1);
  });

  it('retries only the channel that returned a failure and surfaces that warning', async () => {
    harness.state.emailOk = false;
    const first = await createTenantQuote({}, quoteForm('send'));

    expect(first.success).toBe(true);
    expect(first.quoteId).toBe(QUOTE_ID);
    expect(first.warning).toBe('quote-notify');
    expect(quoteSaveNotice(first.warning)).toContain('does not send it again');
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);

    harness.state.emailOk = true;
    const retry = await createTenantQuote({ warning: 'quote-notify' }, quoteForm('send'));

    expect(retry.quoteId).toBe(QUOTE_ID);
    expect(retry.warning).toBeUndefined();
    expect(harness.state.rpcCalls).toBe(1);
    expect(harness.sendEmail).toHaveBeenCalledTimes(2);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.emitWebhook).toHaveBeenCalledTimes(1);
  });

  it('does not insert a second quote while the same key is still in flight', async () => {
    harness.seedRequest(KEY, { quote_id: null, follow_ups: {} });

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/already being saved/);
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.sendEmail).not.toHaveBeenCalled();
  });

  it('returns an error when the saved quote cannot be reloaded', async () => {
    const first = await createTenantQuote({}, quoteForm('draft'));
    expect(first.quoteId).toBe(QUOTE_ID);
    harness.state.quoteLookupError = true;

    const retry = await createTenantQuote({}, quoteForm('draft'));

    expect(retry.success).toBeUndefined();
    expect(retry.quoteId).toBeUndefined();
    expect(retry.error).toMatch(/could not be confirmed/);
    expect(harness.state.rpcCalls).toBe(1);
  });

  it('retries failed steps when another step is still pending', async () => {
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: withPendingClaim({
        entryCodes: 'failed',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'pending',
        promotions: 'ok',
        email: 'pending',
        sms: 'failed',
        webhook: 'ok',
      }),
    });
    harness.state.quoteStatus = 'sent';

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result).toEqual({ success: true, quoteId: QUOTE_ID, warning: 'quote-in-flight' });
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.saveCodes).toHaveBeenCalledTimes(1);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
    const stored = harness.requests.get(`tenant-1:${KEY}`);
    expect(stored?.follow_ups.entryCodes).toBe('ok');
    expect(stored?.follow_ups.sms).toBe('ok');
    expect(stored?.follow_ups.crew).toBe('pending');
    expect(stored?.follow_ups.email).toBe('pending');
    expect(stored?.follow_ups.webhook).toBe('ok');
  });

  it('reports pending steps and does not run them when nothing has failed', async () => {
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: withPendingClaim({
        entryCodes: 'pending',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'pending',
        promotions: 'ok',
        email: 'pending',
        sms: 'ok',
        webhook: 'ok',
      }),
    });
    harness.state.quoteStatus = 'sent';

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result).toEqual({ success: true, quoteId: QUOTE_ID, warning: 'quote-in-flight' });
    expect(quoteSaveNotice(result.warning)).toContain('still being saved');
    expect(quoteSaveNotice(result.warning)).not.toContain('location or crew');
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.saveCodes).not.toHaveBeenCalled();
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.sendSms).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
  });

  it('keeps a failed entry-code retry when email is still pending', async () => {
    harness.state.codeFailuresLeft = 1;
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: withPendingClaim({
        entryCodes: 'failed',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
        email: 'pending',
        sms: 'ok',
        webhook: 'skipped',
      }),
    });
    harness.state.quoteStatus = 'sent';

    const result = await createTenantQuote({}, quoteForm('draft'));

    expect(result.success).toBe(true);
    expect(result.warning).toBe('entry-codes,quote-in-flight');
    expect(harness.saveCodes).toHaveBeenCalledTimes(1);
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.email).toBe('pending');
    expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.entryCodes).toBe('failed');
  });

  it('uses the step warning for an expired quote and does not retry it', async () => {
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'ok',
        locationFacts: 'failed',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
        email: 'failed',
        sms: 'ok',
        webhook: 'ok',
      },
    });
    harness.state.quoteStatus = 'expired';

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result).toEqual({
      success: true,
      quoteId: QUOTE_ID,
      warning: 'location-facts,quote-notify',
    });
    expect(quoteSaveNotice(result.warning)).not.toContain('location or crew');
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.state.quoteStatus).toBe('expired');
    expect(harness.saveCodes).not.toHaveBeenCalled();
    expect(harness.sendEmail).not.toHaveBeenCalled();
  });

  it('uses the crew warning for a failed crew step on a locked quote', async () => {
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'ok',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'failed',
        promotions: 'ok',
        email: 'ok',
        sms: 'ok',
        webhook: 'ok',
      },
    });
    harness.state.quoteStatus = 'sent';
    harness.state.isLocked = true;

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result).toEqual({ success: true, quoteId: QUOTE_ID, warning: 'quote-follow-up' });
    expect(quoteSaveNotice(result.warning)).toContain('location or crew');
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.state.isLocked).toBe(true);
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.sendSms).not.toHaveBeenCalled();
  });

  it('does not send again when the stale clock hits during a held SMS', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(start);
    let releaseSms: (result: { ok: boolean }) => void = () => {};
    const smsGate = new Promise<{ ok: boolean }>((resolve) => {
      releaseSms = resolve;
    });
    harness.sendSms.mockImplementation(() => smsGate);
    try {
      const first = createTenantQuote({}, quoteForm('send'));
      await vi.waitFor(() => expect(harness.sendSms).toHaveBeenCalledTimes(1));

      vi.setSystemTime(new Date(start.getTime() + 3 * 60 * 1000));
      const second = await createTenantQuote({}, quoteForm('send'));

      expect(harness.sendSms).toHaveBeenCalledTimes(1);
      expect(harness.emitWebhook).not.toHaveBeenCalled();
      expect(second.warning).toContain('quote-in-flight');
      releaseSms({ ok: true });
      await first;
      expect(harness.sendSms).toHaveBeenCalledTimes(1);
      expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.sms).toBe('ok');
    } finally {
      harness.sendSms.mockImplementation(async () => ({ ok: harness.state.smsOk }));
      vi.useRealTimers();
    }
  });

  it('reports a failed notification when the follow-up write never lands', async () => {
    harness.state.failFollowUpCommits = true;

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result.success).toBe(true);
    expect(result.quoteId).toBe(QUOTE_ID);
    expect(result.warning).toContain('quote-notify');
    expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.sms).not.toBe('ok');
    expect(harness.sendSms).toHaveBeenCalled();
  });

  it('lets only one overlapping replay send a failed channel', async () => {
    let releaseSms: (result: { ok: boolean }) => void = () => {};
    const smsGate = new Promise<{ ok: boolean }>((resolve) => {
      releaseSms = resolve;
    });
    harness.sendSms.mockImplementationOnce(() => smsGate);
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'ok',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
        email: 'ok',
        sms: 'failed',
        webhook: 'ok',
      },
    });
    harness.state.quoteStatus = 'sent';

    const first = createTenantQuote({}, quoteForm('send'));
    const second = createTenantQuote({}, quoteForm('send'));
    await vi.waitFor(() => expect(harness.sendSms).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    releaseSms({ ok: false });
    const [left, right] = await Promise.all([first, second]);

    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.sms).toBe('failed');
    expect([left.warning, right.warning]).toContain('quote-notify');
  });

  it('retries a pending channel whose claim is older than the stale window', async () => {
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: withPendingClaim(
        {
          entryCodes: 'ok',
          locationFacts: 'ok',
          locationKind: 'ok',
          crew: 'ok',
          promotions: 'ok',
          email: 'pending',
          sms: 'pending',
          webhook: 'pending',
        },
        10 * 60 * 1000,
      ),
    });
    harness.state.quoteStatus = 'sent';

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result).toEqual({ success: true, quoteId: QUOTE_ID });
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.emitWebhook).toHaveBeenCalledTimes(1);
    expect(harness.state.rpcCalls).toBe(0);
    const stored = harness.requests.get(`tenant-1:${KEY}`)?.follow_ups;
    expect(stored?.email).toBe('ok');
    expect(stored?.sms).toBe('ok');
    expect(stored?.webhook).toBe('ok');
  });

  it('does not rewrite a declined quote', async () => {
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'failed',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
        email: 'failed',
        sms: 'ok',
        webhook: 'ok',
      },
    });
    harness.state.quoteStatus = 'declined';

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result).toEqual({
      success: true,
      quoteId: QUOTE_ID,
      warning: 'entry-codes,quote-notify',
    });
    expect(quoteSaveNotice(result.warning)).not.toContain('location or crew');
    expect(harness.state.quoteStatus).toBe('declined');
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.saveCodes).not.toHaveBeenCalled();
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.sendSms).not.toHaveBeenCalled();
  });

  it('uses the stored quote title when retrying a failed channel', async () => {
    harness.state.smsOk = false;
    const first = await createTenantQuote({}, quoteForm('send'));
    expect(first.warning).toBe('quote-notify');
    expect(harness.sendSms.mock.calls[0]?.[0]).toMatchObject({ quoteTitle: 'Weekly clean' });

    harness.state.smsOk = true;
    harness.state.quoteTitle = 'Stored weekly title';
    const form = quoteForm('send');
    form.set('title', 'REWRITTEN TITLE');
    const retry = await createTenantQuote({}, form);

    expect(retry.quoteId).toBe(QUOTE_ID);
    expect(retry.warning).toBeUndefined();
    expect(harness.sendSms).toHaveBeenCalledTimes(2);
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    expect(harness.sendSms.mock.calls[0]?.[0]?.idempotencyKey).toBe(`quote-sms-${QUOTE_ID}`);
    expect(harness.sendSms.mock.calls[1]?.[0]?.idempotencyKey).toBe(`quote-sms-${QUOTE_ID}`);
    expect(harness.sendSms.mock.calls[1]?.[0]).toMatchObject({
      quoteTitle: 'Stored weekly title',
      customerId: CUSTOMER_ID,
    });
    expect(JSON.stringify(harness.sendSms.mock.calls[1]?.[0])).not.toContain('REWRITTEN TITLE');
  });

  it('names migration 0127 when the idempotency table is missing', async () => {
    harness.state.claimError = {
      code: '42P01',
      message: 'relation "public.tenant_quote_create_requests" does not exist',
    };

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result.success).toBeUndefined();
    expect(result.quoteId).toBeUndefined();
    expect(result.error).toContain('0127_quote_create_idempotency');
    expect(harness.state.rpcCalls).toBe(0);
    expect(harness.sendEmail).not.toHaveBeenCalled();

    harness.state.claimError = { code: 'PGRST205', message: 'schema cache' };
    const cached = await createTenantQuote({}, quoteForm('send'));
    expect(cached.error).toContain('0127_quote_create_idempotency');

    harness.state.claimError = { code: '42501', message: 'permission denied' };
    const other = await createTenantQuote({}, quoteForm('send'));
    expect(other.error).toMatch(/could not be confirmed/);
    expect(other.error).not.toContain('0127');
    expect(harness.state.rpcCalls).toBe(0);
  });

  it('rejects a previous id that is not a UUID', async () => {
    const form = quoteForm('draft');
    form.set('create_idempotency_key', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    const result = await createTenantQuote({ quoteId: QUOTE_ID }, form);

    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/Refresh the quote form/);
    expect(harness.state.rpcCalls).toBe(0);
  });

  it('sends on the same process after a missing lease function starts working', async () => {
    harness.state.leaseClaimError = {
      code: 'PGRST202',
      message: 'Could not find the function public.claim_quote_channel_send in the schema cache',
    };

    const first = await createTenantQuote({}, quoteForm('send'));

    expect(first.success).toBe(true);
    expect(first.warning).toContain('quote-notify');
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.sendSms).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
    expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.sms).toBe('failed');

    harness.state.leaseClaimError = null;
    const second = await createTenantQuote({}, quoteForm('send'));

    expect(second).toEqual({ success: true, quoteId: QUOTE_ID });
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.emitWebhook).toHaveBeenCalledTimes(1);
  });

  it('retries on the same process after a lost lease expires', async () => {
    const heldUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'ok',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
        email: 'ok',
        sms: 'failed',
        webhook: 'ok',
        claimToken: { sms: 'owner-a' },
      },
    });
    harness.seedLease(KEY, 'sms', {
      state: 'sending',
      owner_token: 'owner-a',
      provider_key: `quote-sms-${QUOTE_ID}`,
      lease_expires_at: heldUntil,
    });
    harness.state.quoteStatus = 'sent';

    const blocked = await createTenantQuote({}, quoteForm('send'));

    expect(harness.sendSms).not.toHaveBeenCalled();
    expect(blocked.quoteId).toBe(QUOTE_ID);
    const blockedRow = harness.requests.get(`tenant-1:${KEY}`)?.follow_ups;
    expect(blockedRow?.sms).toBe('failed');
    expect((blockedRow?.claimToken as { sms?: string } | undefined)?.sms).toBe('owner-a');

    const until = new Date(Date.now() - 1000).toISOString();
    const followUps = harness.requests.get(`tenant-1:${KEY}`)?.follow_ups;
    if (followUps) {
      followUps.sms = 'unknown';
      followUps.unknownUntil = { sms: until };
    }
    const lease = harness.leases.get(`tenant-1:${KEY}:sms`);
    if (lease) {
      lease.state = 'unknown';
      lease.lease_expires_at = until;
    }

    const retry = await createTenantQuote({}, quoteForm('send'));

    expect(retry).toEqual({ success: true, quoteId: QUOTE_ID });
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.sendSms.mock.calls[0]?.[0]?.idempotencyKey).toBe(`quote-sms-${QUOTE_ID}`);
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
  });

  it('does not send from another instance while a provider lease is still held', async () => {
    resetQuoteChannelSendLeases();
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'ok',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
        email: 'ok',
        sms: 'failed',
        webhook: 'ok',
        claimToken: { sms: 'owner-a' },
      },
    });
    harness.seedLease(KEY, 'sms', {
      state: 'sending',
      owner_token: 'owner-a',
      provider_key: `quote-sms-${QUOTE_ID}`,
      lease_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    harness.state.quoteStatus = 'sent';

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(harness.sendSms).not.toHaveBeenCalled();
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
    expect(result.quoteId).toBe(QUOTE_ID);
    const stored = harness.requests.get(`tenant-1:${KEY}`)?.follow_ups;
    expect(stored?.sms).toBe('failed');
    expect((stored?.claimToken as { sms?: string } | undefined)?.sms).toBe('owner-a');
  });

  it('records a timed-out SMS once it is delivered and does not let another instance send it', async () => {
    setChannelSendTimeoutMsForTests(30);
    let releaseSms: (result: { ok: boolean }) => void = () => {};
    const smsGate = new Promise<{ ok: boolean }>((resolve) => {
      releaseSms = resolve;
    });
    harness.sendSms.mockImplementation(() => smsGate);
    try {
      const first = createTenantQuote({}, quoteForm('send'));
      await vi.waitFor(() => expect(harness.sendSms).toHaveBeenCalledTimes(1));
      const firstResult = await first;

      expect(firstResult.success).toBe(true);
      expect(firstResult.warning).toContain('quote-in-flight');
      expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.sms).toBe('unknown');
      expect(harness.sendSms.mock.calls[0]?.[0]?.idempotencyKey).toBe(`quote-sms-${QUOTE_ID}`);
      expect(harness.sendEmail.mock.calls[0]?.[0]?.idempotencyKey).toBe(`quote-email-${QUOTE_ID}`);
      expect(harness.emitWebhook.mock.calls[0]?.[0]?.eventId).toBe(`quote-webhook-${QUOTE_ID}`);

      resetQuoteChannelSendLeases();
      const second = await createTenantQuote({}, quoteForm('send'));

      expect(harness.sendSms).toHaveBeenCalledTimes(1);
      expect(second.warning).toContain('quote-in-flight');
      expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.sms).toBe('unknown');

      releaseSms({ ok: true });
      await vi.waitFor(() =>
        expect(harness.requests.get(`tenant-1:${KEY}`)?.follow_ups.sms).toBe('ok'),
      );
      resetQuoteChannelSendLeases();
      const third = await createTenantQuote({}, quoteForm('send'));

      expect(third).toEqual({ success: true, quoteId: QUOTE_ID });
      expect(harness.sendSms).toHaveBeenCalledTimes(1);
      expect(harness.sendEmail).toHaveBeenCalledTimes(1);
      expect(harness.emitWebhook).toHaveBeenCalledTimes(1);
    } finally {
      harness.sendSms.mockImplementation(async () => ({ ok: harness.state.smsOk }));
      setChannelSendTimeoutMsForTests(null);
    }
  });

  it('does not retry a cooled-down channel when the quote is accepted, declined, expired, or locked', async () => {
    const blocked = [
      { status: 'accepted', locked: true },
      { status: 'declined', locked: false },
      { status: 'expired', locked: false },
      { status: 'sent', locked: true },
    ] as const;
    const until = new Date(Date.now() - 1000).toISOString();

    for (const current of blocked) {
      harness.requests.clear();
      harness.leases.clear();
      resetQuoteChannelSendLeases();
      harness.sendEmail.mockClear();
      harness.sendSms.mockClear();
      harness.emitWebhook.mockClear();
      harness.state.quoteStatus = current.status;
      harness.state.isLocked = current.locked;
      harness.seedRequest(KEY, {
        quote_id: QUOTE_ID,
        follow_ups: {
          entryCodes: 'failed',
          locationFacts: 'ok',
          locationKind: 'ok',
          crew: 'failed',
          promotions: 'ok',
          email: 'failed',
          sms: 'unknown',
          webhook: 'failed',
          unknownUntil: { sms: until },
          claimToken: { sms: 'owner-a' },
        },
      });
      harness.seedLease(KEY, 'sms', {
        state: 'unknown',
        owner_token: 'owner-a',
        provider_key: `quote-sms-${QUOTE_ID}`,
        lease_expires_at: until,
      });

      const result = await createTenantQuote({}, quoteForm('send'));

      expect(result.quoteId).toBe(QUOTE_ID);
      expect(result.success).toBe(true);
      expect(harness.sendEmail).not.toHaveBeenCalled();
      expect(harness.sendSms).not.toHaveBeenCalled();
      expect(harness.emitWebhook).not.toHaveBeenCalled();
      expect(harness.saveCodes).not.toHaveBeenCalled();
      expect(harness.state.quoteStatus).toBe(current.status);
      expect(harness.state.isLocked).toBe(current.locked);
      expect(harness.state.rpcCalls).toBe(0);
    }
  });

  it('retries an unknown channel after the lease expires when the quote is still sent', async () => {
    const until = new Date(Date.now() - 1000).toISOString();
    harness.seedRequest(KEY, {
      quote_id: QUOTE_ID,
      follow_ups: {
        entryCodes: 'ok',
        locationFacts: 'ok',
        locationKind: 'ok',
        crew: 'ok',
        promotions: 'ok',
        email: 'ok',
        sms: 'unknown',
        webhook: 'ok',
        unknownUntil: { sms: until },
        claimToken: { sms: 'owner-a' },
      },
    });
    harness.seedLease(KEY, 'sms', {
      state: 'unknown',
      owner_token: 'owner-a',
      provider_key: `quote-sms-${QUOTE_ID}`,
      lease_expires_at: until,
    });
    harness.state.quoteStatus = 'sent';

    const result = await createTenantQuote({}, quoteForm('send'));

    expect(result).toEqual({ success: true, quoteId: QUOTE_ID });
    expect(harness.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.sendSms.mock.calls[0]?.[0]?.idempotencyKey).toBe(`quote-sms-${QUOTE_ID}`);
    expect(harness.sendEmail).not.toHaveBeenCalled();
    expect(harness.emitWebhook).not.toHaveBeenCalled();
  });
});
