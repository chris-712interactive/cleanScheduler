import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTRY_CODE_SAVE_WARNING, quoteSaveNotice } from '@/lib/tenant/quoteStructuredFields';

const QUOTE_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const PROPERTY_ID = '33333333-3333-4333-8333-333333333333';
const GATE_CODE = '4412';

const harness = vi.hoisted(() => {
  const state = {
    rpcCalls: 0,
    quoteStatus: 'draft',
    codeFailuresLeft: 0,
    codeThrows: false,
  };
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
  const sendEmail = vi.fn(async () => {});
  const sendSms = vi.fn(async () => {});
  const emitWebhook = vi.fn(async () => {});

  function createMockAdmin() {
    return {
      from(table: string) {
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
        const quote = {
          id: QUOTE_ID,
          status: state.quoteStatus,
          customer_id: CUSTOMER_ID,
          property_id: PROPERTY_ID,
          title: 'Weekly clean',
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

  return { state, saveCodes, sendEmail, sendSms, emitWebhook, createMockAdmin };
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

function quoteForm(intent: 'draft' | 'send'): FormData {
  const form = new FormData();
  form.set('tenant_slug', 'acme');
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
    harness.state.codeFailuresLeft = 0;
    harness.state.codeThrows = false;
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
});
