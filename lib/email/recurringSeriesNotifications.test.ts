import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import {
  describeRecurringFrequency,
  notifyCustomerRecurringSeries,
  notifyCustomerSeriesOccurrenceMoved,
  notifyCustomerSeriesOccurrenceSkipped,
  recurringSeriesChangeKinds,
  type RecurringSeriesSnapshot,
} from '@/lib/email/recurringSeriesNotifications';

const weekly: RecurringSeriesSnapshot = {
  title: 'Weekly clean',
  rruleDefinition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
  anchorStartsAt: '2026-06-01T13:00:00.000Z',
  cleanerNames: ['Alex'],
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
  marketingOptIn?: boolean;
  name?: string;
  rule?: boolean;
  visit?: boolean;
}) {
  return {
    from(table: string) {
      if (table === 'customers') {
        return queryResult({
          id: 'cust-1',
          tenant_id: 'tenant-1',
          customer_identities: { email: 'ada@example.com' },
          tenant_customer_profiles: { marketing_email_opt_in: options?.marketingOptIn ?? false },
        });
      }
      if (table === 'tenant_email_suppressions') {
        return queryResult(options?.suppressed ? { id: 'sup-1' } : null);
      }
      if (table === 'tenants') {
        return queryResult({
          name: options?.name ?? 'Acme Cleaning',
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
        });
      }
      if (table === 'tenant_scheduled_visits') {
        return queryResult(
          options?.visit === false
            ? null
            : { id: 'visit-1', customer_id: 'cust-1', recurring_rule_id: 'rule-1' },
        );
      }
      if (table === 'recurring_appointment_rules') {
        return queryResult(
          options?.rule === false
            ? null
            : { id: 'rule-1', customer_id: 'cust-1', title: 'Weekly clean' },
        );
      }
      if (table === 'tenant_billing_accounts') return queryResult(null);
      if (table === 'tenant_customer_portal_domains') return queryResult(null);
      return queryResult(null);
    },
  };
}

describe('recurring series email', () => {
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

  it('describes weekly, biweekly, and monthly rules', () => {
    expect(describeRecurringFrequency('FREQ=WEEKLY;BYDAY=MO;INTERVAL=1')).toBe('Weekly on Monday');
    expect(describeRecurringFrequency('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR')).toBe(
      'Every other week on Friday',
    );
    expect(describeRecurringFrequency('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15')).toBe(
      'Monthly on day 15',
    );
  });

  it('notices frequency, time, and cleaner changes and ignores an identical series', () => {
    expect(recurringSeriesChangeKinds(weekly, weekly)).toEqual([]);
    expect(
      recurringSeriesChangeKinds(weekly, {
        ...weekly,
        rruleDefinition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=2',
      }),
    ).toEqual(['frequency']);
    expect(
      recurringSeriesChangeKinds(weekly, {
        ...weekly,
        anchorStartsAt: '2026-06-01T15:00:00.000Z',
      }),
    ).toEqual(['time']);
    expect(recurringSeriesChangeKinds(weekly, { ...weekly, cleanerNames: ['Blair'] })).toEqual([
      'cleaner',
    ]);
  });

  it('emails the customer once when a series is created', async () => {
    const result = await notifyCustomerRecurringSeries(adminStub() as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      action: 'created',
      snapshot: weekly,
    });

    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe('ada@example.com');
    expect(send.mock.calls[0]?.[0].subject).toContain('recurring visits are scheduled');
    expect(send.mock.calls[0]?.[0].text).toContain('Weekly on Monday');
    expect(send.mock.calls[0]?.[0].text).toContain('not emailed separately');
    expect(send.mock.calls[0]?.[1].idempotencyKey).toMatch(/^recurring-series-/);
  });

  it('emails the customer once when frequency, time, or cleaner changes', async () => {
    const result = await notifyCustomerRecurringSeries(
      adminStub({ marketingOptIn: false }) as never,
      {
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        ruleId: 'rule-1',
        action: 'changed',
        previous: weekly,
        snapshot: {
          ...weekly,
          cleanerNames: ['Blair'],
          anchorStartsAt: '2026-06-01T15:00:00.000Z',
        },
      },
    );

    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe('ada@example.com');
    expect(send.mock.calls[0]?.[0].text).toContain('Time, Cleaner');
  });

  it('does not email when a save does not change frequency, time, or cleaner', async () => {
    const result = await notifyCustomerRecurringSeries(adminStub() as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      action: 'changed',
      previous: weekly,
      snapshot: { ...weekly, cleanerNames: ['Alex'] },
    });
    expect(result).toMatchObject({ emailed: 0, skipped: 'unchanged' });
    expect(send).not.toHaveBeenCalled();
  });

  it('emails the customer once when the series is cancelled', async () => {
    const result = await notifyCustomerRecurringSeries(adminStub() as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      action: 'cancelled',
      snapshot: weekly,
    });
    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe('ada@example.com');
    expect(send.mock.calls[0]?.[0].subject).toContain('cancelled');
  });

  it('respects a tenant email suppression and still sends when marketing opt-in is off', async () => {
    const blocked = await notifyCustomerRecurringSeries(adminStub({ suppressed: true }) as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      action: 'created',
      snapshot: weekly,
    });
    expect(blocked).toMatchObject({ emailed: 0, skipped: 'suppressed' });
    expect(send).not.toHaveBeenCalled();

    const allowed = await notifyCustomerRecurringSeries(
      adminStub({ marketingOptIn: false }) as never,
      {
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        ruleId: 'rule-1',
        action: 'created',
        snapshot: weekly,
      },
    );
    expect(allowed.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not call Resend when outbound mail is suppressed', async () => {
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');

    const result = await notifyCustomerRecurringSeries(adminStub() as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      action: 'created',
      snapshot: weekly,
    });
    expect(send).not.toHaveBeenCalled();
    expect(result.emailed).toBe(0);
  });

  it('escapes the workspace name in the body and keeps the subject on one line', async () => {
    const name = 'Acme</p><img src=x onerror=alert(1)>\r\nBcc: evil@example.com';
    await notifyCustomerRecurringSeries(adminStub({ name }) as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      action: 'created',
      snapshot: weekly,
    });

    const payload = send.mock.calls[0]?.[0] as { html: string; subject: string };
    expect(payload.html).toContain('Acme&lt;/p&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(payload.html).not.toContain('<img src=x');
    expect(payload.subject).not.toMatch(/[\r\n]/);
    expect(payload.subject).toContain('Bcc: evil@example.com');
  });

  it('does not email generated occurrences from the materializer', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/schedule/recurringVisitMaterialize.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/sendTransactionalEmail|notifyCustomerRecurringSeries/);
  });

  it('emails one skipped occurrence and leaves the series in place', async () => {
    const result = await notifyCustomerSeriesOccurrenceSkipped(adminStub() as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      title: 'Weekly "deep" clean',
      startsAt: '2026-06-08T13:00:00.000Z',
    });

    expect(result.emailed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]?.[0] as { html: string; subject: string; text: string };
    expect(payload.subject).toContain('one visit was cancelled');
    expect(payload.text).toContain('Only this date was cancelled.');
    expect(payload.text).not.toContain('will not be added');
    expect(payload.html).toContain('Weekly &quot;deep&quot; clean');
    expect(payload.html).not.toContain('Weekly "deep" clean');
    const key = send.mock.calls[0]?.[1].idempotencyKey as string;
    expect(key).toMatch(/^series-occurrence-/);

    await notifyCustomerSeriesOccurrenceSkipped(adminStub() as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      title: 'Weekly "deep" clean',
      startsAt: '2026-06-08T13:00:00.000Z',
    });
    expect(send.mock.calls[1]?.[1].idempotencyKey).toBe(key);
  });

  it('skips an occurrence email when the series is outside the tenant or the address is suppressed', async () => {
    const missing = await notifyCustomerSeriesOccurrenceSkipped(
      adminStub({ rule: false }) as never,
      {
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        ruleId: 'rule-1',
        visitId: 'visit-1',
        title: 'Weekly clean',
        startsAt: '2026-06-08T13:00:00.000Z',
      },
    );
    expect(missing).toMatchObject({ emailed: 0, skipped: 'no_series' });

    const blocked = await notifyCustomerSeriesOccurrenceSkipped(
      adminStub({ suppressed: true }) as never,
      {
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        ruleId: 'rule-1',
        visitId: 'visit-1',
        title: 'Weekly clean',
        startsAt: '2026-06-08T13:00:00.000Z',
      },
    );
    expect(blocked).toMatchObject({ emailed: 0, skipped: 'suppressed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps a skipped-occurrence subject on one line when outbound mail is suppressed', async () => {
    const name = 'Acme\r\nBcc: evil@example.com';
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    const suppressed = await notifyCustomerSeriesOccurrenceSkipped(adminStub({ name }) as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      title: 'Weekly clean',
      startsAt: '2026-06-08T13:00:00.000Z',
    });
    expect(suppressed.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();

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

    await notifyCustomerSeriesOccurrenceSkipped(adminStub({ name }) as never, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      title: 'Weekly clean',
      startsAt: '2026-06-08T13:00:00.000Z',
    });
    const subject = (send.mock.calls[0]?.[0] as { subject: string }).subject;
    expect(subject).not.toMatch(/[\r\n\u0000]/);
    expect(subject).toContain('Bcc: evil@example.com');
  });

  it('emails one moved occurrence with the old and new time, not the whole series', async () => {
    const params = {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      title: 'Weekly <b>"deep"</b> clean',
      previousStartsAt: '2026-06-08T13:00:00.000Z',
      previousEndsAt: '2026-06-08T15:00:00.000Z',
      nextStartsAt: '2026-06-09T14:00:00.000Z',
      nextEndsAt: '2026-06-09T16:00:00.000Z',
    };
    const result = await notifyCustomerSeriesOccurrenceMoved(adminStub() as never, params);
    expect(result.emailed).toBe(1);
    const payload = send.mock.calls[0]?.[0] as { html: string; text: string; subject: string };
    expect(payload.subject).toContain('one visit was moved');
    expect(payload.subject).not.toContain('series');
    expect(payload.text).toContain('Previous time');
    expect(payload.text).toContain('New time');
    expect(payload.text).toContain('Only this date was moved.');
    expect(payload.text).not.toContain('will not be added');
    expect(payload.html).toContain('Weekly &lt;b&gt;&quot;deep&quot;&lt;/b&gt; clean');
    expect(payload.html).not.toContain('<b>');
    const key = send.mock.calls[0]?.[1].idempotencyKey as string;
    expect(key).toMatch(/^series-occurrence-move-/);
    await notifyCustomerSeriesOccurrenceMoved(adminStub() as never, params);
    expect(send.mock.calls[1]?.[1].idempotencyKey).toBe(key);
    await notifyCustomerSeriesOccurrenceMoved(adminStub() as never, {
      ...params,
      nextStartsAt: '2026-06-10T14:00:00.000Z',
    });
    expect(send.mock.calls[2]?.[1].idempotencyKey).not.toBe(key);
  });

  it('skips a move when nothing changed, the series is outside the tenant, or the address is suppressed', async () => {
    const base = {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      title: 'Weekly clean',
      previousStartsAt: '2026-06-08T13:00:00.000Z',
      previousEndsAt: '2026-06-08T15:00:00.000Z',
      nextStartsAt: '2026-06-09T14:00:00.000Z',
      nextEndsAt: '2026-06-09T16:00:00.000Z',
    };
    const same = await notifyCustomerSeriesOccurrenceMoved(adminStub() as never, {
      ...base,
      nextStartsAt: base.previousStartsAt,
      nextEndsAt: base.previousEndsAt,
    });
    expect(same).toMatchObject({ emailed: 0, skipped: 'unchanged' });

    const missing = await notifyCustomerSeriesOccurrenceMoved(
      adminStub({ visit: false }) as never,
      base,
    );
    expect(missing).toMatchObject({ emailed: 0, skipped: 'no_series' });

    const blocked = await notifyCustomerSeriesOccurrenceMoved(
      adminStub({ suppressed: true }) as never,
      base,
    );
    expect(blocked).toMatchObject({ emailed: 0, skipped: 'suppressed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps a moved-occurrence subject on one line when outbound mail is suppressed', async () => {
    const name = 'Acme\r\nBcc: evil@example.com';
    const params = {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      title: 'Weekly clean',
      previousStartsAt: '2026-06-08T13:00:00.000Z',
      previousEndsAt: '2026-06-08T15:00:00.000Z',
      nextStartsAt: '2026-06-09T14:00:00.000Z',
      nextEndsAt: '2026-06-09T16:00:00.000Z',
    };
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
    const suppressed = await notifyCustomerSeriesOccurrenceMoved(
      adminStub({ name }) as never,
      params,
    );
    expect(suppressed.emailed).toBe(0);
    expect(send).not.toHaveBeenCalled();

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

    await notifyCustomerSeriesOccurrenceMoved(adminStub({ name }) as never, params);
    const subject = (send.mock.calls[0]?.[0] as { subject: string }).subject;
    expect(subject).not.toMatch(/[\r\n\u0000]/);
    expect(subject).toContain('one visit was moved');
    expect(subject).toContain('Bcc: evil@example.com');
  });
});
