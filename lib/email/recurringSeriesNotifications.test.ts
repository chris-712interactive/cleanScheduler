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

function adminStub(options?: { suppressed?: boolean; marketingOptIn?: boolean }) {
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
        });
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

  it('does not email generated occurrences from the materializer', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/schedule/recurringVisitMaterialize.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/sendTransactionalEmail|notifyCustomerRecurringSeries/);
  });
});
