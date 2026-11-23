import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import { notifyCustomerRescheduleResolved } from '@/lib/email/rescheduleNotifications';

const tenantRow = {
  name: 'Acme Cleaning',
  slug: 'acme',
  timezone: 'America/New_York',
  brand_color: '#006D77',
  logo_url: null,
  business_phone: '555-0100',
  business_email: 'office@acme.test',
  address_line1: '1 Main',
  city: 'Asheville',
  state: 'NC',
  postal_code: '28801',
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
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve(resolved);
      return () => proxy;
    },
  });
  return proxy;
}

function adminStub(options?: { name?: string; timezone?: string; title?: string }) {
  return {
    from(table: string) {
      if (table === 'customers') {
        return queryResult({
          customer_identities: { email: 'ada@example.com' },
        });
      }
      if (table === 'tenant_scheduled_visits') {
        return queryResult({
          title: options?.title ?? 'Spring "deep" clean',
          starts_at: '2026-06-08T13:00:00.000Z',
        });
      }
      if (table === 'tenants') {
        return queryResult({
          ...tenantRow,
          name: options?.name ?? tenantRow.name,
          timezone: options?.timezone ?? tenantRow.timezone,
        });
      }
      if (table === 'tenant_billing_accounts') return queryResult(null);
      if (table === 'tenant_customer_portal_domains') return queryResult(null);
      return queryResult(null);
    },
  };
}

const base = {
  tenantId: 'tenant-1',
  customerId: 'cust-1',
  visitId: 'visit-1',
  resolution: 'completed' as const,
  tenantNote: null,
};

describe('reschedule approval email', () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ data: { id: 'email_1' }, error: null });
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

  it('formats the previous and new windows in the tenant timezone', async () => {
    const cases: Array<{
      timezone: string;
      previousStartsAt: string;
      previousEndsAt: string;
      appliedStartsAt: string;
      appliedEndsAt: string;
      previous: string;
      next: string;
    }> = [
      {
        timezone: 'America/New_York',
        previousStartsAt: '2026-06-08T13:00:00.000Z',
        previousEndsAt: '2026-06-08T15:00:00.000Z',
        appliedStartsAt: '2026-06-09T14:00:00.000Z',
        appliedEndsAt: '2026-06-09T16:00:00.000Z',
        previous: 'Monday, June 8 at 9:00 AM – 11:00 AM',
        next: 'Tuesday, June 9 at 10:00 AM – 12:00 PM',
      },
      {
        timezone: 'America/New_York',
        previousStartsAt: '2026-06-09T02:00:00.000Z',
        previousEndsAt: '2026-06-09T05:00:00.000Z',
        appliedStartsAt: '2026-06-10T02:00:00.000Z',
        appliedEndsAt: '2026-06-10T05:00:00.000Z',
        previous: 'Monday, June 8 at 10:00 PM – Tuesday, June 9 at 1:00 AM',
        next: 'Tuesday, June 9 at 10:00 PM – Wednesday, June 10 at 1:00 AM',
      },
      {
        timezone: 'America/Chicago',
        previousStartsAt: '2026-06-07T13:00:00.000Z',
        previousEndsAt: '2026-06-07T15:00:00.000Z',
        appliedStartsAt: '2026-06-08T13:00:00.000Z',
        appliedEndsAt: '2026-06-08T15:00:00.000Z',
        previous: 'Sunday, June 7 at 8:00 AM – 10:00 AM',
        next: 'Monday, June 8 at 8:00 AM – 10:00 AM',
      },
      {
        timezone: 'America/New_York',
        previousStartsAt: '2026-03-08T06:30:00.000Z',
        previousEndsAt: '2026-03-08T07:30:00.000Z',
        appliedStartsAt: '2026-03-08T03:00:00.000Z',
        appliedEndsAt: '2026-03-08T07:30:00.000Z',
        previous: 'Sunday, March 8 at 1:30 AM – 3:30 AM',
        next: 'Saturday, March 7 at 10:00 PM – Sunday, March 8 at 3:30 AM',
      },
    ];

    for (const item of cases) {
      send.mockClear();
      await notifyCustomerRescheduleResolved(adminStub({ timezone: item.timezone }) as never, {
        ...base,
        previousStartsAt: item.previousStartsAt,
        previousEndsAt: item.previousEndsAt,
        appliedStartsAt: item.appliedStartsAt,
        appliedEndsAt: item.appliedEndsAt,
      });
      const text = (send.mock.calls[0]?.[0] as { text: string }).text;
      expect(text).toContain(`Previous time: ${item.previous}`);
      expect(text).toContain(`New time: ${item.next}`);
      expect(text).not.toContain('Jun 9, 2026, 2:00 AM');
    }
  });

  it('still names the full new window when the previous time was not passed', async () => {
    await notifyCustomerRescheduleResolved(adminStub() as never, {
      ...base,
      appliedStartsAt: '2026-06-09T02:00:00.000Z',
      appliedEndsAt: '2026-06-09T05:00:00.000Z',
    });
    const text = (send.mock.calls[0]?.[0] as { text: string }).text;
    expect(text).not.toContain('Previous time');
    expect(text).toContain('New time: Monday, June 8 at 10:00 PM – Tuesday, June 9 at 1:00 AM');
    expect(text).not.toContain('Jun 9, 2026, 2:00 AM');
  });

  it('escapes the note and visit name and keeps the subject on one line', async () => {
    await notifyCustomerRescheduleResolved(
      adminStub({
        name: 'Acme\r\nBcc: evil@example.com',
        title: 'Spring <b>"deep"</b>',
      }) as never,
      {
        ...base,
        tenantNote: 'See <img src=x>',
        appliedStartsAt: '2026-06-08T13:00:00.000Z',
        appliedEndsAt: '2026-06-08T15:00:00.000Z',
        previousStartsAt: '2026-06-07T13:00:00.000Z',
        previousEndsAt: '2026-06-07T15:00:00.000Z',
      },
    );
    const payload = send.mock.calls[0]?.[0] as { html: string; subject: string; text: string };
    expect(payload.subject).toContain('reschedule request approved');
    expect(payload.subject).not.toMatch(/[\r\n\u0000]/);
    expect(payload.subject).toContain('Bcc: evil@example.com');
    expect(payload.html).toContain('Spring &lt;b&gt;&quot;deep&quot;&lt;/b&gt;');
    expect(payload.html).toContain('See &lt;img src=x&gt;');
    expect(payload.html).not.toContain('<b>');
    expect(payload.html).not.toContain('<img');
    expect(payload.text).toContain('Previous time: Sunday, June 7 at 9:00 AM – 11:00 AM');
    expect(payload.text).toContain('New time: Monday, June 8 at 9:00 AM – 11:00 AM');
  });

  it('does not throw when Resend rejects the approval', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'down', name: 'api_error' } });
    await expect(
      notifyCustomerRescheduleResolved(adminStub() as never, {
        ...base,
        appliedStartsAt: '2026-06-08T13:00:00.000Z',
        appliedEndsAt: '2026-06-08T15:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });

  it('omits the window when the request is declined', async () => {
    await notifyCustomerRescheduleResolved(adminStub() as never, {
      ...base,
      resolution: 'declined',
      appliedStartsAt: null,
      appliedEndsAt: null,
      previousStartsAt: '2026-06-08T13:00:00.000Z',
      previousEndsAt: '2026-06-08T15:00:00.000Z',
    });
    const payload = send.mock.calls[0]?.[0] as { text: string; subject: string };
    expect(payload.subject).toContain('declined');
    expect(payload.text).not.toContain('New time');
    expect(payload.text).not.toContain('Previous time');
  });
});
