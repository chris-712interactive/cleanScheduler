import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import type { CleanerScheduleVisit } from '@/lib/email/cleanerScheduleChange';
import {
  deliverCleanerScheduleEmails,
  notifyCleanerScheduleChanges,
} from '@/lib/email/notifyCleanerScheduleChanges';

const visit: CleanerScheduleVisit = {
  id: 'visit-a',
  title: 'Deep clean',
  customerName: 'Jane Smith',
  startsAt: '2026-05-12T15:00:00.000Z',
  endsAt: '2026-05-12T17:00:00.000Z',
  status: 'scheduled',
  routeSequence: 1,
  assigneeIds: ['alex'],
};

function queryResult(data: unknown) {
  const resolved = { data, error: null };
  const self: Record<string, unknown> = {};
  const proxy = new Proxy(self, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(resolved).then(resolve, reject);
      }
      if (prop === 'maybeSingle') return () => Promise.resolve(resolved);
      return () => proxy;
    },
  });
  return proxy;
}

function adminStub() {
  return {
    from(table: string) {
      if (table === 'tenants') {
        return queryResult({ slug: 'acme', name: 'Acme Cleaning', timezone: 'America/New_York' });
      }
      if (table === 'tenant_memberships') {
        return queryResult([{ user_id: 'alex', is_active: true }]);
      }
      return queryResult([
        {
          id: 'visit-a',
          title: 'Deep clean',
          starts_at: visit.startsAt,
          ends_at: visit.endsAt,
          status: 'scheduled',
          route_sequence: 2,
          tenant_scheduled_visit_assignees: [{ user_id: 'alex' }],
          customers: {
            customer_identities: {
              first_name: 'Jane',
              last_name: 'Smith',
              full_name: 'Jane Smith',
            },
          },
        },
      ]);
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { email: 'alex@example.com' } }, error: null }),
      },
    },
  };
}

describe('cleaner schedule email delivery', () => {
  beforeEach(() => {
    send.mockClear();
    vi.unstubAllEnvs();
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

  it('does not call Resend when outbound mail is suppressed', async () => {
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');

    const result = await notifyCleanerScheduleChanges(adminStub() as never, {
      tenantId: 'tenant-1',
      actorUserId: 'office',
      before: [{ ...visit, routeSequence: 1 }],
      after: [{ ...visit, routeSequence: 2 }],
    });

    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ emailed: 0, skipped: 1, failed: 0 });
  });

  it('passes one idempotency key for the cleaner and logs a provider failure without throwing', async () => {
    send.mockResolvedValueOnce({
      data: null,
      error: { message: 'rejected', name: 'validation_error' },
    });

    const delivered = await deliverCleanerScheduleEmails([
      {
        to: 'alex@example.com',
        subject: 'Acme Cleaning: your schedule changed',
        text: 'Changed',
        html: '<p>Changed</p>',
        idempotencyKey: 'cleaner-schedule-abc',
      },
    ]);

    expect(delivered).toEqual({ emailed: 0, skipped: 0, failed: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[1]).toEqual({ idempotencyKey: 'cleaner-schedule-abc' });

    send.mockRejectedValueOnce(new Error('socket down'));
    await expect(
      deliverCleanerScheduleEmails([
        {
          to: 'alex@example.com',
          subject: 'Acme Cleaning: your schedule changed',
          text: 'Changed',
          html: '<p>Changed</p>',
          idempotencyKey: 'cleaner-schedule-abc',
        },
      ]),
    ).resolves.toEqual({ emailed: 0, skipped: 0, failed: 1 });
  });
});
