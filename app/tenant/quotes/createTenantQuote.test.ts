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
  };
  const requests = new Map<
    string,
    { quote_id: string | null; follow_ups: Record<string, string> }
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
  const sendEmail = vi.fn(async () => ({ ok: state.emailOk }));
  const sendSms = vi.fn(async () => ({ ok: state.smsOk }));
  const emitWebhook = vi.fn(async () => ({ ok: state.webhookOk }));

  function seedRequest(
    key: string,
    row: { quote_id: string | null; follow_ups: Record<string, string> },
  ) {
    requests.set(`tenant-1:${key}`, row);
  }

  function requestQuery() {
    const filters: Record<string, string> = {};
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: {
      tenant_id?: string;
      idempotency_key?: string;
      quote_id?: string;
      follow_ups?: Record<string, string>;
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
      maybeSingle: () => Promise.resolve(run()),
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(onFulfilled, onRejected);
      },
    };
    return api;

    function run() {
      const id = `${filters.tenant_id ?? payload?.tenant_id ?? 'tenant-1'}:${filters.idempotency_key ?? payload?.idempotency_key ?? ''}`;
      if (op === 'insert') {
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
        if (!row) return { error: { message: 'missing' } };
        if (payload?.quote_id) row.quote_id = payload.quote_id;
        if (payload?.follow_ups) row.follow_ups = payload.follow_ups;
        return { error: null };
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
        return query(table);
      },
      async rpc(name: string, args: { p_status?: string }) {
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
          title: 'Weekly clean',
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
    seedRequest,
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
  sendQuoteNotificationEmail: () => harness.sendEmail(),
}));

vi.mock('@/lib/sms/quoteNotificationSms', () => ({
  sendQuoteNotificationSms: () => harness.sendSms(),
}));

vi.mock('@/lib/integrations/emitQuoteWebhook', () => ({
  emitQuoteWebhookEvent: () => harness.emitWebhook(),
}));

vi.mock('@/lib/portal/invalidatePortalCache', () => ({
  invalidateCustomerQuoteBadge: () => {},
}));

import { createTenantQuote, type QuoteFormState } from './actions';

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
    harness.requests.clear();
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

  it('rejects a previous id that is not a UUID', async () => {
    const form = quoteForm('draft');
    form.set('create_idempotency_key', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    const result = await createTenantQuote({ quoteId: QUOTE_ID }, form);

    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/Refresh the quote form/);
    expect(harness.state.rpcCalls).toBe(0);
  });
});
