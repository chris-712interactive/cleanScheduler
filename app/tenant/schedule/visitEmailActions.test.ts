import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  notifyOffice: vi.fn(async () => ({ emailed: 1, skipped: 'none' as const })),
  notifySkip: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1, skipped: 'none' as const };
  }),
  insertError: null as { message: string } | null,
  deleteError: null as { message: string } | null,
  visit: {
    id: 'visit-1',
    title: 'Weekly clean',
    recurring_rule_id: 'rule-1' as string | null,
    starts_at: '2026-06-08T13:00:00.000Z',
    customer_id: 'cust-1',
    property_id: null as string | null,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/portal/invalidatePortalCache', () => ({
  invalidateTenantNavBadges: () => {},
}));
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
vi.mock('@/lib/billing/resolveVisitExpectedAmount', () => ({
  resolveScheduleJobPriceCents: async () => ({ expectedAmountCents: 0 }),
}));
vi.mock('@/lib/integrations/emitVisitWebhook', () => ({
  emitVisitWebhookEvent: async () => {},
}));
vi.mock('@/lib/schedule/loadCleanerScheduleVisits', () => ({
  loadCleanerScheduleVisitSnapshots: async () => ({ ok: true, visits: [] }),
}));
vi.mock('@/lib/schedule/recurringOccurrenceSkips', () => ({
  recordRecurringOccurrenceSkip: async () => {},
}));
vi.mock('@/lib/email/notifyCleanerScheduleChanges', () => ({
  queueCleanerScheduleNotice: () => {},
}));
vi.mock('@/lib/email/officeVisitNotifications', () => ({
  notifyCustomerOfficeVisitCreated: () => harness.notifyOffice(),
}));
vi.mock('@/lib/email/recurringSeriesNotifications', () => ({
  notifyCustomerSeriesOccurrenceSkipped: (admin: unknown, params: unknown) =>
    harness.notifySkip(admin, params),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      let op = 'select';
      const self: Record<string, unknown> = {};
      const proxy = new Proxy(self, {
        get(_target, prop) {
          if (prop === 'insert' || prop === 'update' || prop === 'delete' || prop === 'upsert') {
            return () => {
              op = String(prop);
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
        if (table === 'customers') return { data: { id: 'cust-1' }, error: null };
        if (table === 'tenants') return { data: { timezone: 'America/New_York' }, error: null };
        if (table === 'tenant_scheduled_visits' && op === 'insert') {
          return harness.insertError
            ? { data: null, error: harness.insertError }
            : { data: { id: 'visit-1' }, error: null };
        }
        if (table === 'tenant_scheduled_visits' && op === 'select') {
          return { data: harness.visit, error: null };
        }
        if (table === 'tenant_scheduled_visits' && op === 'delete') {
          return harness.deleteError
            ? { data: null, error: harness.deleteError }
            : { data: null, error: null };
        }
        return { data: null, error: null };
      }

      return proxy;
    },
  }),
}));

import { createScheduledVisit, deleteScheduledVisit } from '@/app/tenant/schedule/actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function capture(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('REDIRECT:')) return message.slice('REDIRECT:'.length);
    throw error;
  }
  return '';
}

describe('visit actions email after a successful write', () => {
  beforeEach(() => {
    harness.notifyOffice.mockClear();
    harness.notifySkip.mockClear();
    harness.insertError = null;
    harness.deleteError = null;
    harness.visit = {
      id: 'visit-1',
      title: 'Weekly clean',
      recurring_rule_id: 'rule-1',
      starts_at: '2026-06-08T13:00:00.000Z',
      customer_id: 'cust-1',
      property_id: null,
    };
  });

  it('emails the customer once after an office one-off visit is saved', async () => {
    const url = await capture(() =>
      createScheduledVisit(
        {},
        form({
          tenant_slug: 'acme',
          customer_id: 'cust-1',
          title: 'Spring clean',
          starts_at: '2026-06-08T09:00',
          ends_at: '2026-06-08T11:00',
          status: 'scheduled',
        }),
      ),
    );
    expect(url).toContain('/schedule');
    expect(harness.notifyOffice).toHaveBeenCalledTimes(1);
    expect(harness.notifySkip).not.toHaveBeenCalled();
  });

  it('does not email when the visit insert fails or the visit is not scheduled', async () => {
    harness.insertError = { message: 'locked' };
    const failed = await createScheduledVisit(
      {},
      form({
        tenant_slug: 'acme',
        customer_id: 'cust-1',
        starts_at: '2026-06-08T09:00',
        ends_at: '2026-06-08T11:00',
      }),
    );
    expect(failed.error).toBe('locked');
    expect(harness.notifyOffice).not.toHaveBeenCalled();

    harness.insertError = null;
    const cancelled = await capture(() =>
      createScheduledVisit(
        {},
        form({
          tenant_slug: 'acme',
          customer_id: 'cust-1',
          starts_at: '2026-06-08T09:00',
          ends_at: '2026-06-08T11:00',
          status: 'cancelled',
        }),
      ),
    );
    expect(cancelled).toContain('/schedule');
    expect(harness.notifyOffice).not.toHaveBeenCalled();
  });

  it('emails one skipped series date after that occurrence is deleted', async () => {
    const url = await capture(() =>
      deleteScheduledVisit({}, form({ tenant_slug: 'acme', visit_id: 'visit-1' })),
    );
    expect(url).toContain('/schedule');
    expect(harness.notifySkip).toHaveBeenCalledTimes(1);
    expect(harness.notifySkip.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      startsAt: '2026-06-08T13:00:00.000Z',
    });
  });

  it('does not email when the delete fails or the visit is not part of a series', async () => {
    harness.deleteError = { message: 'locked' };
    const failed = await deleteScheduledVisit(
      {},
      form({ tenant_slug: 'acme', visit_id: 'visit-1' }),
    );
    expect(failed.error).toBe('locked');
    expect(harness.notifySkip).not.toHaveBeenCalled();

    harness.visit = { ...harness.visit, recurring_rule_id: null };
    await capture(() =>
      deleteScheduledVisit({}, form({ tenant_slug: 'acme', visit_id: 'visit-1' })),
    );
    expect(harness.notifySkip).not.toHaveBeenCalled();
  });
});
