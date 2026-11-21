import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import {
  notifyCleanerOfTimeOffDecision,
  notifyOfficeOfTimeOffRequest,
} from '@/lib/email/timeOffNotifications';

const tenantRow = {
  slug: 'acme',
  name: 'Acme Cleaning',
  timezone: 'America/New_York',
  business_email: 'office@acme.test',
  business_phone: null,
  brand_color: null,
  logo_url: null,
  address_line1: null,
  city: null,
  state: null,
  postal_code: null,
  country: 'US',
  work_week_days: null,
  work_day_start: null,
  work_day_end: null,
  work_day_hours: null,
};

function queryResult(data: unknown, single: unknown = data) {
  const self: Record<string, unknown> = {};
  const proxy = new Proxy(self, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve, reject);
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: single, error: null });
      }
      return () => proxy;
    },
  });
  return proxy;
}

function adminStub(options?: { inactive?: boolean; suppressed?: boolean }) {
  return {
    from(table: string) {
      if (table === 'tenant_memberships') {
        const active = !options?.inactive;
        return queryResult(
          active
            ? [
                { user_id: 'owner-1', is_active: true },
                { user_id: 'cleaner-1', is_active: true },
              ]
            : [],
          { is_active: active },
        );
      }
      if (table === 'user_profiles') return queryResult({ display_name: 'Casey Cleaner' });
      if (table === 'tenants') return queryResult(tenantRow);
      if (table === 'tenant_onboarding_profiles') {
        return queryResult({ owner_email: 'owner@example.com', company_email: null });
      }
      if (table === 'tenant_email_suppressions') {
        return queryResult(options?.suppressed ? { id: 'sup-1' } : null);
      }
      return queryResult(null);
    },
    auth: {
      admin: {
        getUserById: async (userId: string) => ({
          data: {
            user: {
              email: userId === 'cleaner-1' ? 'casey@example.com' : 'owner@example.com',
            },
          },
          error: null,
        }),
      },
    },
  };
}

describe('time off email delivery', () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ data: { id: 'email_1' }, error: null });
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'office@example.com';
    process.env.NEXT_PUBLIC_APP_ENV = 'local';
    process.env.NEXT_PUBLIC_APP_DOMAIN = 'lvh.me';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.OUTBOUND_SUPPRESSED;
    delete process.env.VERCEL_ENV;
  });

  it('emails other owners once and not the person who requested time off', async () => {
    const result = await notifyOfficeOfTimeOffRequest(adminStub() as never, {
      tenantId: 'tenant-1',
      requestId: 'req-1',
      requesterUserId: 'cleaner-1',
      startsAt: '2026-06-01T13:00:00.000Z',
      endsAt: '2026-06-01T21:00:00.000Z',
      requestNote: 'Doctor',
    });

    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe('owner@example.com');
    expect(send.mock.calls[0]?.[1].idempotencyKey).toMatch(/^time-off-/);
  });

  it('emails the cleaner once when time off is approved', async () => {
    const result = await notifyCleanerOfTimeOffDecision(adminStub() as never, {
      tenantId: 'tenant-1',
      requestId: 'req-1',
      cleanerUserId: 'cleaner-1',
      decision: 'approved',
      startsAt: '2026-06-01T13:00:00.000Z',
      endsAt: '2026-06-01T21:00:00.000Z',
      reviewNote: 'Enjoy',
    });

    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe('casey@example.com');
    expect(send.mock.calls[0]?.[0].subject).toContain('approved');
  });

  it('emails the cleaner once when time off is denied', async () => {
    const result = await notifyCleanerOfTimeOffDecision(adminStub() as never, {
      tenantId: 'tenant-1',
      requestId: 'req-1',
      cleanerUserId: 'cleaner-1',
      decision: 'denied',
      startsAt: '2026-06-01T13:00:00.000Z',
      endsAt: '2026-06-01T21:00:00.000Z',
      reviewNote: '',
    });

    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe('casey@example.com');
    expect(send.mock.calls[0]?.[0].subject).toContain('denied');
  });

  it('skips a cleaner who is inactive or whose address is suppressed', async () => {
    const inactive = await notifyCleanerOfTimeOffDecision(adminStub({ inactive: true }) as never, {
      tenantId: 'tenant-1',
      requestId: 'req-1',
      cleanerUserId: 'cleaner-1',
      decision: 'approved',
      startsAt: '2026-06-01T13:00:00.000Z',
      endsAt: '2026-06-01T21:00:00.000Z',
      reviewNote: '',
    });
    expect(inactive.emailed).toBe(0);

    const suppressed = await notifyCleanerOfTimeOffDecision(
      adminStub({ suppressed: true }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'req-1',
        cleanerUserId: 'cleaner-1',
        decision: 'denied',
        startsAt: '2026-06-01T13:00:00.000Z',
        endsAt: '2026-06-01T21:00:00.000Z',
        reviewNote: '',
      },
    );
    expect(suppressed.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
