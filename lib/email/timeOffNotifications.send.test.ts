import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import {
  notifyCleanerOfHoursChangeDecision,
  notifyCleanerOfTimeOffDecision,
  notifyOfficeOfTimeOffCancellation,
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

function adminStub(options?: {
  inactive?: boolean;
  suppressed?: boolean;
  displayName?: string;
  workspaceName?: string;
  missingHours?: boolean;
  companyHours?: boolean;
}) {
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
      if (table === 'user_profiles') {
        return queryResult({ display_name: options?.displayName ?? 'Casey Cleaner' });
      }
      if (table === 'tenants') {
        return queryResult({ ...tenantRow, name: options?.workspaceName ?? tenantRow.name });
      }
      if (table === 'tenant_member_availability_change_requests') {
        return queryResult(
          options?.missingHours
            ? null
            : { id: 'hours-1', use_tenant_default: options?.companyHours ?? false },
        );
      }
      if (table === 'tenant_member_availability_change_request_days') {
        return queryResult(
          options?.companyHours ? [] : [{ weekday: 'mon', starts_at: '08:00', ends_at: '17:00' }],
        );
      }
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

  it('collapses a line break in the requester name so the subject stays one line', async () => {
    await notifyOfficeOfTimeOffRequest(
      adminStub({ displayName: 'Casey\r\nBcc: evil@example.com' }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'req-1',
        requesterUserId: 'cleaner-1',
        startsAt: '2026-06-01T13:00:00.000Z',
        endsAt: '2026-06-01T21:00:00.000Z',
        requestNote: 'Doctor',
      },
    );

    const subject = (send.mock.calls[0]?.[0] as { subject: string }).subject;
    expect(subject).not.toMatch(/[\r\n\u0000]/);
    expect(subject).toContain('Casey Bcc: evil@example.com');
  });

  it('does not email an owner whose address is on the suppression list', async () => {
    const result = await notifyOfficeOfTimeOffRequest(adminStub({ suppressed: true }) as never, {
      tenantId: 'tenant-1',
      requestId: 'req-1',
      requesterUserId: 'cleaner-1',
      startsAt: '2026-06-01T13:00:00.000Z',
      endsAt: '2026-06-01T21:00:00.000Z',
      requestNote: '',
    });
    expect(result.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();
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

  it('escapes quotes in the decision note and keeps the subject on one line', async () => {
    await notifyCleanerOfTimeOffDecision(
      adminStub({ workspaceName: 'Acme\r\nBcc: evil@example.com' }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'req-1',
        cleanerUserId: 'cleaner-1',
        decision: 'denied',
        startsAt: '2026-06-01T13:00:00.000Z',
        endsAt: '2026-06-01T21:00:00.000Z',
        reviewNote: 'Say "no"',
      },
    );

    const payload = send.mock.calls[0]?.[0] as { html: string; subject: string };
    expect(payload.html).toContain('Say &quot;no&quot;');
    expect(payload.html).not.toContain('Say "no"');
    expect(payload.subject).not.toMatch(/[\r\n\u0000]/);
    expect(payload.subject).toContain('Bcc: evil@example.com');
    expect(payload.subject).toContain('denied');
  });

  it('emails the cleaner once when an hour change is approved or denied', async () => {
    const approved = await notifyCleanerOfHoursChangeDecision(adminStub() as never, {
      tenantId: 'tenant-1',
      requestId: 'hours-1',
      cleanerUserId: 'cleaner-1',
      decision: 'approved',
      reviewNote: 'Use the "front" desk hours',
    });
    expect(approved.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const approvedPayload = send.mock.calls[0]?.[0] as {
      to: string;
      html: string;
      subject: string;
    };
    expect(approvedPayload.to).toBe('casey@example.com');
    expect(approvedPayload.subject).toContain('hour change approved');
    expect(approvedPayload.html).toContain('Mon 08:00–17:00');
    expect(approvedPayload.html).toContain('&quot;front&quot;');
    expect(approvedPayload.html).not.toContain('"front"');
    const approvedKey = send.mock.calls[0]?.[1].idempotencyKey as string;
    expect(approvedKey).toMatch(/^time-off-/);

    const denied = await notifyCleanerOfHoursChangeDecision(adminStub() as never, {
      tenantId: 'tenant-1',
      requestId: 'hours-1',
      cleanerUserId: 'cleaner-1',
      decision: 'denied',
      reviewNote: '',
    });
    expect(denied.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0].subject).toContain('hour change denied');
    expect(send.mock.calls[1]?.[0].text).toContain('current hours stay');
    expect(send.mock.calls[1]?.[1].idempotencyKey).toMatch(/^time-off-/);
    expect(send.mock.calls[1]?.[1].idempotencyKey).not.toBe(approvedKey);
  });

  it('skips an hour-change decision when the membership is inactive, the request is missing, or the address is suppressed', async () => {
    const inactive = await notifyCleanerOfHoursChangeDecision(
      adminStub({ inactive: true }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'hours-1',
        cleanerUserId: 'cleaner-1',
        decision: 'approved',
        reviewNote: '',
      },
    );
    expect(inactive.emailed).toBe(0);

    const missing = await notifyCleanerOfHoursChangeDecision(
      adminStub({ missingHours: true }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'hours-1',
        cleanerUserId: 'cleaner-1',
        decision: 'denied',
        reviewNote: '',
      },
    );
    expect(missing.emailed).toBe(0);

    const suppressed = await notifyCleanerOfHoursChangeDecision(
      adminStub({ suppressed: true }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'hours-1',
        cleanerUserId: 'cleaner-1',
        decision: 'approved',
        reviewNote: '',
      },
    );
    expect(suppressed.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('emails the office once when a cleaner cancels their own time off', async () => {
    const result = await notifyOfficeOfTimeOffCancellation(
      adminStub({ displayName: 'Casey\r\nBcc: evil@example.com' }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'req-1',
        requesterUserId: 'cleaner-1',
        startsAt: '2026-06-01T13:00:00.000Z',
        endsAt: '2026-06-01T21:00:00.000Z',
        requestNote: 'Say "never mind"',
      },
    );
    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]?.[0] as { to: string; html: string; subject: string };
    expect(payload.to).toBe('owner@example.com');
    expect(payload.to).not.toBe('casey@example.com');
    expect(payload.subject).not.toMatch(/[\r\n\u0000]/);
    expect(payload.subject).toContain('Casey Bcc: evil@example.com');
    expect(payload.html).toContain('&quot;never mind&quot;');
    expect(payload.html).not.toContain('"never mind"');
    const key = send.mock.calls[0]?.[1].idempotencyKey as string;
    expect(key).toMatch(/^time-off-/);

    await notifyOfficeOfTimeOffCancellation(adminStub() as never, {
      tenantId: 'tenant-1',
      requestId: 'req-1',
      requesterUserId: 'cleaner-1',
      startsAt: '2026-06-01T13:00:00.000Z',
      endsAt: '2026-06-01T21:00:00.000Z',
      requestNote: '',
    });
    expect(send.mock.calls[1]?.[1].idempotencyKey).toBe(key);
  });

  it('does not email a suppressed office address and does not call Resend when outbound mail is suppressed', async () => {
    const blocked = await notifyOfficeOfTimeOffCancellation(
      adminStub({ suppressed: true }) as never,
      {
        tenantId: 'tenant-1',
        requestId: 'req-1',
        requesterUserId: 'cleaner-1',
        startsAt: '2026-06-01T13:00:00.000Z',
        endsAt: '2026-06-01T21:00:00.000Z',
        requestNote: '',
      },
    );
    expect(blocked.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();

    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    const suppressed = await notifyCleanerOfHoursChangeDecision(adminStub() as never, {
      tenantId: 'tenant-1',
      requestId: 'hours-1',
      cleanerUserId: 'cleaner-1',
      decision: 'approved',
      reviewNote: '',
    });
    expect(suppressed.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
