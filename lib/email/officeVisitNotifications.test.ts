import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import {
  notifyCustomerOfficeVisitCancelled,
  notifyCustomerOfficeVisitCreated,
  notifyCustomerOfficeVisitRescheduled,
} from '@/lib/email/officeVisitNotifications';

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

function adminStub(options?: {
  suppressed?: boolean;
  name?: string;
  title?: string;
  status?: string;
  recurring?: boolean;
  email?: string | null;
  cleaner?: string | null;
}) {
  return {
    from(table: string) {
      if (table === 'tenant_scheduled_visits') {
        return queryResult({
          id: 'visit-1',
          customer_id: 'cust-1',
          title: options?.title ?? 'Standard clean',
          starts_at: '2026-06-08T13:00:00.000Z',
          status: options?.status ?? 'scheduled',
          recurring_rule_id: options?.recurring ? 'rule-1' : null,
        });
      }
      if (table === 'customers') {
        return queryResult({
          id: 'cust-1',
          tenant_id: 'tenant-1',
          customer_identities: {
            email: options?.email === undefined ? 'ada@example.com' : options.email,
          },
          tenant_customer_profiles: { marketing_email_opt_in: false },
        });
      }
      if (table === 'tenant_email_suppressions') {
        return queryResult(options?.suppressed ? { id: 'sup-1' } : null);
      }
      if (table === 'tenants') {
        return queryResult({ ...tenantRow, name: options?.name ?? tenantRow.name });
      }
      if (table === 'tenant_scheduled_visit_assignees') {
        return queryResult(options?.cleaner ? [{ user_id: 'cleaner-1' }] : []);
      }
      if (table === 'user_profiles') {
        return queryResult([{ user_id: 'cleaner-1', display_name: options?.cleaner ?? '' }]);
      }
      if (table === 'tenant_billing_accounts') return queryResult(null);
      if (table === 'tenant_customer_portal_domains') return queryResult(null);
      return queryResult(null);
    },
  };
}

const created = { tenantId: 'tenant-1', visitId: 'visit-1' };

describe('office one-off visit email', () => {
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

  it('emails the customer once for a single scheduled visit', async () => {
    const result = await notifyCustomerOfficeVisitCreated(
      adminStub({ title: 'Spring "deep" clean', cleaner: 'Alex' }) as never,
      created,
    );
    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]?.[0] as {
      to: string;
      html: string;
      text: string;
      subject: string;
    };
    expect(payload.to).toBe('ada@example.com');
    expect(payload.subject).toContain('your visit is scheduled');
    expect(payload.text).toContain('single visit');
    expect(payload.text).toContain('Alex');
    expect(payload.html).toContain('Spring &quot;deep&quot; clean');
    expect(payload.html).not.toContain('Spring "deep" clean');
    const key = send.mock.calls[0]?.[1].idempotencyKey as string;
    expect(key).toMatch(/^office-visit-/);

    await notifyCustomerOfficeVisitCreated(
      adminStub({ title: 'Spring "deep" clean', cleaner: 'Alex' }) as never,
      created,
    );
    expect(send.mock.calls[1]?.[1].idempotencyKey).toBe(key);
  });

  it('does not email a series occurrence, a visit that is not scheduled, or a missing address', async () => {
    const series = await notifyCustomerOfficeVisitCreated(
      adminStub({ recurring: true }) as never,
      created,
    );
    expect(series).toMatchObject({ emailed: 0, skipped: 'not_one_off' });

    const cancelled = await notifyCustomerOfficeVisitCreated(
      adminStub({ status: 'cancelled' }) as never,
      created,
    );
    expect(cancelled).toMatchObject({ emailed: 0, skipped: 'not_one_off' });

    const missing = await notifyCustomerOfficeVisitCreated(
      adminStub({ email: null }) as never,
      created,
    );
    expect(missing).toMatchObject({ emailed: 0, skipped: 'no_email' });
    expect(send).not.toHaveBeenCalled();
  });

  it('respects suppression and still sends when marketing opt-in is off', async () => {
    const blocked = await notifyCustomerOfficeVisitCreated(
      adminStub({ suppressed: true }) as never,
      created,
    );
    expect(blocked).toMatchObject({ emailed: 0, skipped: 'suppressed' });
    expect(send).not.toHaveBeenCalled();

    const allowed = await notifyCustomerOfficeVisitCreated(adminStub() as never, created);
    expect(allowed.emailed).toBe(1);
  });

  it('strips control characters from the subject and does not call Resend when outbound mail is suppressed', async () => {
    await notifyCustomerOfficeVisitCreated(
      adminStub({ name: 'Acme\r\nBcc: evil@example.com' }) as never,
      created,
    );
    const subject = (send.mock.calls[0]?.[0] as { subject: string }).subject;
    expect(subject).not.toMatch(/[\r\n\u0000]/);
    expect(subject).toContain('Bcc: evil@example.com');

    send.mockClear();
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    const suppressed = await notifyCustomerOfficeVisitCreated(adminStub() as never, created);
    expect(suppressed.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

const previous = {
  previousStartsAt: '2026-06-08T13:00:00.000Z',
  previousEndsAt: '2026-06-08T15:00:00.000Z',
};
const nextWindow = {
  nextStartsAt: '2026-06-09T14:00:00.000Z',
  nextEndsAt: '2026-06-09T16:00:00.000Z',
};

describe('office visit time and cancellation email', () => {
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

  it('emails the old and new time once, with quotes escaped', async () => {
    const params = {
      ...created,
      ...previous,
      ...nextWindow,
    };
    const result = await notifyCustomerOfficeVisitRescheduled(
      adminStub({ title: 'Spring <b>"deep"</b> & co' }) as never,
      params,
    );
    expect(result.emailed).toBe(1);
    const payload = send.mock.calls[0]?.[0] as { html: string; text: string; subject: string };
    expect(payload.subject).toContain('your visit time changed');
    expect(payload.text).toContain('Previous time');
    expect(payload.text).toContain('New time');
    expect(payload.text).toContain('Monday, June 8 at 9:00 AM – 11:00 AM');
    expect(payload.text).toContain('Tuesday, June 9 at 10:00 AM – 12:00 PM');
    expect(payload.text).toContain('single visit');
    expect(payload.html).toContain('Spring &lt;b&gt;&quot;deep&quot;&lt;/b&gt; &amp; co');
    expect(payload.html).not.toContain('<b>');
    const key = send.mock.calls[0]?.[1].idempotencyKey as string;
    expect(key).toMatch(/^office-visit-time-/);

    await notifyCustomerOfficeVisitRescheduled(
      adminStub({ title: 'Spring <b>"deep"</b> & co' }) as never,
      params,
    );
    expect(send.mock.calls[1]?.[1].idempotencyKey).toBe(key);

    await notifyCustomerOfficeVisitRescheduled(
      adminStub({ title: 'Spring <b>"deep"</b> & co' }) as never,
      { ...params, nextStartsAt: '2026-06-10T14:00:00.000Z' },
    );
    expect(send.mock.calls[2]?.[1].idempotencyKey).not.toBe(key);
  });

  it('does not email an unchanged window, a series visit, or a suppressed address', async () => {
    const same = await notifyCustomerOfficeVisitRescheduled(adminStub() as never, {
      ...created,
      previousStartsAt: '2026-06-08T13:00:00.000Z',
      previousEndsAt: '2026-06-08T15:00:00.000Z',
      nextStartsAt: '2026-06-08T13:00:00.000Z',
      nextEndsAt: '2026-06-08T15:00:00.000Z',
    });
    expect(same).toMatchObject({ emailed: 0, skipped: 'unchanged' });

    const series = await notifyCustomerOfficeVisitRescheduled(
      adminStub({ recurring: true }) as never,
      { ...created, ...previous, ...nextWindow },
    );
    expect(series).toMatchObject({ emailed: 0, skipped: 'not_one_off' });

    const blocked = await notifyCustomerOfficeVisitRescheduled(
      adminStub({ suppressed: true }) as never,
      { ...created, ...previous, ...nextWindow },
    );
    expect(blocked).toMatchObject({ emailed: 0, skipped: 'suppressed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('names the end date when a changed window crosses midnight', async () => {
    const result = await notifyCustomerOfficeVisitRescheduled(adminStub() as never, {
      ...created,
      previousStartsAt: '2026-06-09T02:00:00.000Z',
      previousEndsAt: '2026-06-09T05:00:00.000Z',
      nextStartsAt: '2026-06-10T02:00:00.000Z',
      nextEndsAt: '2026-06-10T05:00:00.000Z',
    });
    expect(result.emailed).toBe(1);
    const text = (send.mock.calls[0]?.[0] as { text: string }).text;
    expect(text).toContain('Monday, June 8 at 10:00 PM – Tuesday, June 9 at 1:00 AM');
    expect(text).toContain('Tuesday, June 9 at 10:00 PM – Wednesday, June 10 at 1:00 AM');
  });

  it('emails a cancelled one-off visit once and keeps the subject on one line', async () => {
    const params = {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      visitId: 'visit-1',
      title: 'Spring <b>"deep"</b>',
      startsAt: '2026-06-08T13:00:00.000Z',
      endsAt: '2026-06-08T15:00:00.000Z',
    };
    const result = await notifyCustomerOfficeVisitCancelled(
      adminStub({ name: 'Acme\r\nBcc: evil@example.com' }) as never,
      params,
    );
    expect(result.emailed).toBe(1);
    const payload = send.mock.calls[0]?.[0] as { html: string; text: string; subject: string };
    expect(payload.subject).toContain('your visit was cancelled');
    expect(payload.subject).not.toMatch(/[\r\n\u0000]/);
    expect(payload.subject).toContain('Bcc: evil@example.com');
    expect(payload.text).toContain('This visit is cancelled.');
    expect(payload.text).not.toContain('repeating');
    expect(payload.html).toContain('Spring &lt;b&gt;&quot;deep&quot;&lt;/b&gt;');
    expect(payload.html).not.toContain('<b>');
    const key = send.mock.calls[0]?.[1].idempotencyKey as string;
    expect(key).toMatch(/^office-visit-cancel-/);
    await notifyCustomerOfficeVisitCancelled(
      adminStub({ name: 'Acme\r\nBcc: evil@example.com' }) as never,
      params,
    );
    expect(send.mock.calls[1]?.[1].idempotencyKey).toBe(key);
  });

  it('skips a suppressed cancellation and does not call Resend when outbound mail is suppressed', async () => {
    const params = {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      visitId: 'visit-1',
      title: 'Spring clean',
      startsAt: '2026-06-08T13:00:00.000Z',
      endsAt: '2026-06-08T15:00:00.000Z',
    };
    const blocked = await notifyCustomerOfficeVisitCancelled(
      adminStub({ suppressed: true }) as never,
      params,
    );
    expect(blocked).toMatchObject({ emailed: 0, skipped: 'suppressed' });
    expect(send).not.toHaveBeenCalled();

    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    const suppressed = await notifyCustomerOfficeVisitRescheduled(adminStub() as never, {
      ...created,
      ...previous,
      ...nextWindow,
    });
    expect(suppressed.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
