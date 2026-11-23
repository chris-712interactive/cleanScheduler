import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  notifyOffice: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1 };
  }),
  notifyCleaner: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1 };
  }),
  notifyConflicts: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 0 };
  }),
  notifyCancel: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1 };
  }),
  insertError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  updated: {
    user_id: 'cleaner-1',
    starts_at: '2026-06-01T13:00:00.000Z',
    ends_at: '2026-06-01T21:00:00.000Z',
  } as null | {
    user_id: string;
    starts_at: string;
    ends_at: string;
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

vi.mock('@/lib/auth/tenantAccess', () => ({
  requireTenantPortalAccess: async () => ({
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    role: 'owner',
    roleId: null,
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  getAuthContext: async () => ({ user: { id: 'cleaner-1' } }),
}));

vi.mock('@/lib/portal/invalidatePortalCache', () => ({
  invalidateTenantNavBadges: () => {},
}));

vi.mock('@/lib/schedule/timeOffVisitConflicts', () => ({
  listVisitsOverlappingTimeOff: async () => [],
}));

vi.mock('@/lib/email/timeOffNotifications', () => ({
  notifyOfficeOfTimeOffRequest: (admin: unknown, params: unknown) =>
    harness.notifyOffice(admin, params),
  notifyOfficeOfTimeOffCancellation: (admin: unknown, params: unknown) =>
    harness.notifyCancel(admin, params),
  notifyOfficeOfTimeOffConflicts: (admin: unknown, params: unknown) =>
    harness.notifyConflicts(admin, params),
  notifyCleanerOfTimeOffDecision: (admin: unknown, params: unknown) =>
    harness.notifyCleaner(admin, params),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from() {
      let op = 'select';
      const self: Record<string, unknown> = {};
      const proxy = new Proxy(self, {
        get(_target, prop) {
          if (prop === 'insert' || prop === 'update') {
            return () => {
              op = String(prop);
              return proxy;
            };
          }
          if (prop === 'maybeSingle' || prop === 'single') return async () => result();
          return () => proxy;
        },
      });

      function result() {
        if (op === 'insert') {
          return harness.insertError
            ? { data: null, error: harness.insertError }
            : { data: { id: 'req-1' }, error: null };
        }
        if (op === 'update') {
          return harness.updateError
            ? { data: null, error: harness.updateError }
            : { data: harness.updated, error: null };
        }
        return { data: null, error: null };
      }

      return proxy;
    },
  }),
}));

import {
  cancelTimeOffRequestAction,
  reviewTimeOffRequestAction,
  submitTimeOffRequestAction,
} from '@/app/tenant/schedule/time-off/actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('time off actions email only after a successful write', () => {
  beforeEach(() => {
    harness.notifyOffice.mockClear();
    harness.notifyCleaner.mockClear();
    harness.notifyConflicts.mockClear();
    harness.notifyCancel.mockClear();
    harness.insertError = null;
    harness.updateError = null;
    harness.updated = {
      user_id: 'cleaner-1',
      starts_at: '2026-06-01T13:00:00.000Z',
      ends_at: '2026-06-01T21:00:00.000Z',
    };
  });

  it('does not email the office when the request fails to save', async () => {
    harness.insertError = { message: 'constraint' };
    const result = await submitTimeOffRequestAction(
      {},
      form({
        tenant_slug: 'acme',
        starts_at: '2026-06-01T09:00',
        ends_at: '2026-06-01T17:00',
        client_timezone_offset: '0',
        request_note: 'Doctor',
      }),
    );
    expect(result.error).toBe('constraint');
    expect(harness.notifyOffice).not.toHaveBeenCalled();
  });

  it('emails the office once after the request is saved', async () => {
    const result = await submitTimeOffRequestAction(
      {},
      form({
        tenant_slug: 'acme',
        starts_at: '2026-06-01T09:00',
        ends_at: '2026-06-01T17:00',
        client_timezone_offset: '0',
      }),
    );
    expect(result.success).toBeTruthy();
    expect(harness.notifyOffice).toHaveBeenCalledTimes(1);
    expect(harness.notifyOffice.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      requestId: 'req-1',
      requesterUserId: 'cleaner-1',
    });
  });

  it('does not email the cleaner when the decision fails to save', async () => {
    harness.updateError = { message: 'conflict' };
    const result = await reviewTimeOffRequestAction(
      {},
      form({
        tenant_slug: 'acme',
        request_id: 'req-1',
        decision: 'approved',
      }),
    );
    expect(result.error).toBe('conflict');
    expect(harness.notifyCleaner).not.toHaveBeenCalled();
  });

  it('emails the cleaner once when the request is approved', async () => {
    const result = await reviewTimeOffRequestAction(
      {},
      form({
        tenant_slug: 'acme',
        request_id: 'req-1',
        decision: 'approved',
        review_note: 'Enjoy',
      }),
    );
    expect(result.success).toContain('approved');
    expect(harness.notifyCleaner).toHaveBeenCalledTimes(1);
    expect(harness.notifyCleaner.mock.calls[0]?.[1]).toMatchObject({
      cleanerUserId: 'cleaner-1',
      decision: 'approved',
      requestId: 'req-1',
    });
  });

  it('emails the cleaner once when the request is denied', async () => {
    const result = await reviewTimeOffRequestAction(
      {},
      form({
        tenant_slug: 'acme',
        request_id: 'req-1',
        decision: 'denied',
      }),
    );
    expect(result.success).toContain('denied');
    expect(harness.notifyCleaner).toHaveBeenCalledTimes(1);
    expect(harness.notifyCleaner.mock.calls[0]?.[1]).toMatchObject({ decision: 'denied' });
    expect(harness.notifyConflicts).not.toHaveBeenCalled();
  });

  it('emails the office once when the cleaner cancels their own pending request', async () => {
    const result = await cancelTimeOffRequestAction(
      {},
      form({ tenant_slug: 'acme', request_id: 'req-1' }),
    );
    expect(result.success).toContain('cancelled');
    expect(harness.notifyCancel).toHaveBeenCalledTimes(1);
    expect(harness.notifyCancel.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      requestId: 'req-1',
      requesterUserId: 'cleaner-1',
      startsAt: '2026-06-01T13:00:00.000Z',
    });
  });

  it('does not email the office when the cancellation does not update a pending request', async () => {
    harness.updated = null;
    const missing = await cancelTimeOffRequestAction(
      {},
      form({ tenant_slug: 'acme', request_id: 'req-1' }),
    );
    expect(missing.error).toMatch(/pending/);
    expect(harness.notifyCancel).not.toHaveBeenCalled();

    harness.updated = {
      user_id: 'cleaner-1',
      starts_at: '2026-06-01T13:00:00.000Z',
      ends_at: '2026-06-01T21:00:00.000Z',
    };
    harness.updateError = { message: 'locked' };
    const failed = await cancelTimeOffRequestAction(
      {},
      form({ tenant_slug: 'acme', request_id: 'req-1' }),
    );
    expect(failed.error).toBe('locked');
    expect(harness.notifyCancel).not.toHaveBeenCalled();
  });
});
