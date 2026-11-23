import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import { notifyCustomerOfficeVisitCreated } from '@/lib/email/officeVisitNotifications';

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
