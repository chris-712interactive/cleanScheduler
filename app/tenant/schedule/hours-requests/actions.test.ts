import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  notify: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1 };
  }),
  updateError: null as { message: string } | null,
  request: {
    id: 'hours-1',
    user_id: 'cleaner-1',
    use_tenant_default: false,
  } as null | { id: string; user_id: string; use_tenant_default: boolean },
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
  getAuthContext: async () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('@/lib/email/timeOffNotifications', () => ({
  notifyCleanerOfHoursChangeDecision: (admin: unknown, params: unknown) =>
    harness.notify(admin, params),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      let op = 'select';
      const self: Record<string, unknown> = {};
      const proxy = new Proxy(self, {
        get(_target, prop) {
          if (prop === 'update') {
            return () => {
              op = 'update';
              return proxy;
            };
          }
          if (prop === 'maybeSingle' || prop === 'single') return async () => result();
          if (prop === 'then') {
            return (resolve: (value: unknown) => unknown) =>
              Promise.resolve(result()).then(resolve);
          }
          return () => proxy;
        },
      });

      function result() {
        if (op === 'update') {
          return harness.updateError
            ? { data: null, error: harness.updateError }
            : { data: null, error: null };
        }
        if (table === 'tenant_member_availability_change_requests') {
          return { data: harness.request, error: null };
        }
        if (table === 'tenant_member_availability_change_request_days') {
          return { data: [{ weekday: 'mon', starts_at: '08:00', ends_at: '17:00' }], error: null };
        }
        return { data: null, error: null };
      }

      return proxy;
    },
  }),
}));

import { reviewHoursChangeAction } from '@/app/tenant/schedule/hours-requests/actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('hour change decisions email the requester after the save', () => {
  beforeEach(() => {
    harness.notify.mockClear();
    harness.updateError = null;
    harness.request = { id: 'hours-1', user_id: 'cleaner-1', use_tenant_default: false };
  });

  it('emails once when the change is approved', async () => {
    const result = await reviewHoursChangeAction(
      {},
      form({
        tenant_slug: 'acme',
        request_id: 'hours-1',
        decision: 'approved',
        review_note: 'Yes',
      }),
    );
    expect(result.success).toContain('approved');
    expect(harness.notify).toHaveBeenCalledTimes(1);
    expect(harness.notify.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      requestId: 'hours-1',
      cleanerUserId: 'cleaner-1',
      decision: 'approved',
    });
  });

  it('emails once when the change is denied', async () => {
    const result = await reviewHoursChangeAction(
      {},
      form({ tenant_slug: 'acme', request_id: 'hours-1', decision: 'denied' }),
    );
    expect(result.success).toContain('denied');
    expect(harness.notify).toHaveBeenCalledTimes(1);
    expect(harness.notify.mock.calls[0]?.[1]).toMatchObject({ decision: 'denied' });
  });

  it('does not email when the decision fails to save or the request is gone', async () => {
    harness.updateError = { message: 'locked' };
    const failed = await reviewHoursChangeAction(
      {},
      form({ tenant_slug: 'acme', request_id: 'hours-1', decision: 'approved' }),
    );
    expect(failed.error).toBe('locked');

    harness.updateError = null;
    harness.request = null;
    const missing = await reviewHoursChangeAction(
      {},
      form({ tenant_slug: 'acme', request_id: 'hours-1', decision: 'denied' }),
    );
    expect(missing.error).toMatch(/pending/);
    expect(harness.notify).not.toHaveBeenCalled();
  });
});
