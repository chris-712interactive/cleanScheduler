import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  notifyOffice: vi.fn(async () => ({ emailed: 1, skipped: 'none' as const })),
  notifySkip: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1, skipped: 'none' as const };
  }),
  notifyCancel: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1, skipped: 'none' as const };
  }),
  notifyReschedule: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1, skipped: 'none' as const };
  }),
  notifyMove: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1, skipped: 'none' as const };
  }),
  applyTime: vi.fn(async (): Promise<{ ok: true } | { ok: false; error: string }> => ({
    ok: true,
  })),
  insertError: null as { message: string } | null,
  deleteError: null as { message: string } | null,
  role: 'owner' as 'owner' | 'admin' | 'employee' | 'viewer',
  writes: 0,
  visit: {
    id: 'visit-1',
    title: 'Weekly clean',
    recurring_rule_id: 'rule-1' as string | null,
    starts_at: '2026-06-08T13:00:00.000Z',
    ends_at: '2026-06-08T15:00:00.000Z',
    status: 'scheduled' as const,
    checked_in_at: null as string | null,
    visit_purpose: 'service' as const,
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
    role: harness.role,
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
vi.mock('@/lib/schedule/applyVisitScheduleTime', () => ({
  applyVisitScheduleTime: () => harness.applyTime(),
}));
vi.mock('@/lib/email/officeVisitNotifications', () => ({
  notifyCustomerOfficeVisitCreated: () => harness.notifyOffice(),
  notifyCustomerOfficeVisitCancelled: (admin: unknown, params: unknown) =>
    harness.notifyCancel(admin, params),
  notifyCustomerOfficeVisitRescheduled: (admin: unknown, params: unknown) =>
    harness.notifyReschedule(admin, params),
}));
vi.mock('@/lib/email/recurringSeriesNotifications', () => ({
  notifyCustomerSeriesOccurrenceSkipped: (admin: unknown, params: unknown) =>
    harness.notifySkip(admin, params),
  notifyCustomerSeriesOccurrenceMoved: (admin: unknown, params: unknown) =>
    harness.notifyMove(admin, params),
  notifyCustomerRecurringSeries: async () => ({ emailed: 1, skipped: 'none' as const }),
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
              harness.writes += 1;
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

import {
  createScheduledVisit,
  deleteScheduledVisit,
  updateScheduledVisitTimes,
} from '@/app/tenant/schedule/actions';

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
    harness.notifyCancel.mockClear();
    harness.notifyReschedule.mockClear();
    harness.notifyMove.mockClear();
    harness.applyTime.mockClear();
    harness.applyTime.mockResolvedValue({ ok: true });
    harness.insertError = null;
    harness.deleteError = null;
    harness.role = 'owner';
    harness.writes = 0;
    harness.visit = {
      id: 'visit-1',
      title: 'Weekly clean',
      recurring_rule_id: 'rule-1',
      starts_at: '2026-06-08T13:00:00.000Z',
      ends_at: '2026-06-08T15:00:00.000Z',
      status: 'scheduled',
      checked_in_at: null,
      visit_purpose: 'service',
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
    expect(harness.writes).toBeGreaterThan(0);
    expect(harness.notifySkip).toHaveBeenCalledTimes(1);
    expect(harness.notifySkip.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      startsAt: '2026-06-08T13:00:00.000Z',
      endsAt: '2026-06-08T15:00:00.000Z',
    });
  });

  it('does not email when the delete fails', async () => {
    harness.deleteError = { message: 'locked' };
    const failed = await deleteScheduledVisit(
      {},
      form({ tenant_slug: 'acme', visit_id: 'visit-1' }),
    );
    expect(failed.error).toBe('locked');
    expect(harness.notifySkip).not.toHaveBeenCalled();
    expect(harness.notifyCancel).not.toHaveBeenCalled();
  });

  it('emails a cancelled one-off visit and does not describe a series', async () => {
    harness.visit = { ...harness.visit, recurring_rule_id: null };
    const url = await capture(() =>
      deleteScheduledVisit({}, form({ tenant_slug: 'acme', visit_id: 'visit-1' })),
    );
    expect(url).toContain('/schedule');
    expect(harness.notifySkip).not.toHaveBeenCalled();
    expect(harness.notifyCancel).toHaveBeenCalledTimes(1);
    expect(harness.notifyCancel.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      visitId: 'visit-1',
      startsAt: '2026-06-08T13:00:00.000Z',
      endsAt: '2026-06-08T15:00:00.000Z',
    });
  });

  it('lets an admin delete and still emails once', async () => {
    harness.role = 'admin';
    const url = await capture(() =>
      deleteScheduledVisit({}, form({ tenant_slug: 'acme', visit_id: 'visit-1' })),
    );
    expect(url).toContain('/schedule');
    expect(harness.writes).toBeGreaterThan(0);
    expect(harness.notifySkip).toHaveBeenCalledTimes(1);
  });

  it('rejects a field employee before any delete or email', async () => {
    harness.role = 'employee';
    const result = await deleteScheduledVisit(
      {},
      form({ tenant_slug: 'acme', visit_id: 'visit-1' }),
    );
    expect(result.error).toBe('Only owners and admins can delete a visit.');
    expect(harness.writes).toBe(0);
    expect(harness.notifySkip).not.toHaveBeenCalled();
    expect(harness.notifyCancel).not.toHaveBeenCalled();
  });

  it('still deletes a one-off visit when the cancel email throws', async () => {
    harness.visit = { ...harness.visit, recurring_rule_id: null };
    harness.notifyCancel.mockRejectedValueOnce(new Error('resend down'));
    const url = await capture(() =>
      deleteScheduledVisit({}, form({ tenant_slug: 'acme', visit_id: 'visit-1' })),
    );
    expect(url).toContain('/schedule');
    expect(harness.notifyCancel).toHaveBeenCalledTimes(1);
  });
});

describe('visit time changes email after a successful save', () => {
  beforeEach(() => {
    harness.notifyReschedule.mockClear();
    harness.notifyMove.mockClear();
    harness.notifySkip.mockClear();
    harness.applyTime.mockClear();
    harness.applyTime.mockResolvedValue({ ok: true });
    harness.role = 'owner';
    harness.writes = 0;
    harness.visit = {
      id: 'visit-1',
      title: 'Spring clean',
      recurring_rule_id: null,
      starts_at: '2026-06-08T13:00:00.000Z',
      ends_at: '2026-06-08T15:00:00.000Z',
      status: 'scheduled',
      checked_in_at: null,
      visit_purpose: 'service',
      customer_id: 'cust-1',
      property_id: null,
    };
  });

  it('emails the old and new time once when an office visit moves', async () => {
    const result = await updateScheduledVisitTimes(
      {},
      form({
        tenant_slug: 'acme',
        visit_id: 'visit-1',
        starts_at: '2026-06-09T10:00',
        ends_at: '2026-06-09T12:00',
      }),
    );
    expect(result.success).toBe(true);
    expect(harness.applyTime).toHaveBeenCalledTimes(1);
    expect(harness.notifyReschedule).toHaveBeenCalledTimes(1);
    expect(harness.notifyMove).not.toHaveBeenCalled();
    expect(harness.notifySkip).not.toHaveBeenCalled();
    expect(harness.notifyReschedule.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      visitId: 'visit-1',
      previousStartsAt: '2026-06-08T13:00:00.000Z',
      previousEndsAt: '2026-06-08T15:00:00.000Z',
    });
    const next = harness.notifyReschedule.mock.calls[0]?.[1] as {
      nextStartsAt: string;
      nextEndsAt: string;
    };
    expect(next.nextStartsAt).not.toBe('2026-06-08T13:00:00.000Z');
    expect(new Date(next.nextEndsAt).getTime()).toBeGreaterThan(
      new Date(next.nextStartsAt).getTime(),
    );
  });

  it('does not email when the customer-visible time is unchanged or the save fails', async () => {
    const same = await updateScheduledVisitTimes(
      {},
      form({
        tenant_slug: 'acme',
        visit_id: 'visit-1',
        starts_at: '2026-06-08T09:00',
        ends_at: '2026-06-08T11:00',
      }),
    );
    expect(same.success).toBe(true);
    expect(harness.applyTime).toHaveBeenCalledTimes(1);
    expect(harness.notifyReschedule).not.toHaveBeenCalled();

    harness.applyTime.mockResolvedValue({ ok: false, error: 'overlap' });
    const failed = await updateScheduledVisitTimes(
      {},
      form({
        tenant_slug: 'acme',
        visit_id: 'visit-1',
        starts_at: '2026-06-09T10:00',
        ends_at: '2026-06-09T12:00',
      }),
    );
    expect(failed.error).toBe('overlap');
    expect(harness.notifyReschedule).not.toHaveBeenCalled();
    expect(harness.notifyMove).not.toHaveBeenCalled();
  });

  it('emails only that occurrence when a series visit moves, including an admin', async () => {
    harness.role = 'admin';
    harness.visit = { ...harness.visit, recurring_rule_id: 'rule-1', title: 'Weekly clean' };
    const result = await updateScheduledVisitTimes(
      {},
      form({
        tenant_slug: 'acme',
        visit_id: 'visit-1',
        starts_at: '2026-06-09T10:00',
        ends_at: '2026-06-09T12:00',
        edit_scope: 'occurrence',
      }),
    );
    expect(result.success).toBe(true);
    expect(harness.notifyMove).toHaveBeenCalledTimes(1);
    expect(harness.notifyReschedule).not.toHaveBeenCalled();
    expect(harness.notifySkip).not.toHaveBeenCalled();
    expect(harness.notifyMove.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      visitId: 'visit-1',
      previousStartsAt: '2026-06-08T13:00:00.000Z',
    });
  });

  it('asks for a scope before changing a series visit', async () => {
    harness.visit = { ...harness.visit, recurring_rule_id: 'rule-1' };
    const result = await updateScheduledVisitTimes(
      {},
      form({
        tenant_slug: 'acme',
        visit_id: 'visit-1',
        starts_at: '2026-06-09T10:00',
        ends_at: '2026-06-09T12:00',
      }),
    );
    expect(result.error).toBe('Choose this visit only, or this and future visits.');
    expect(harness.applyTime).not.toHaveBeenCalled();
    expect(harness.notifyMove).not.toHaveBeenCalled();
  });

  it('rejects a field employee before any time write or email', async () => {
    harness.role = 'employee';
    const result = await updateScheduledVisitTimes(
      {},
      form({
        tenant_slug: 'acme',
        visit_id: 'visit-1',
        starts_at: '2026-06-09T10:00',
        ends_at: '2026-06-09T12:00',
      }),
    );
    expect(result.error).toBe('Only owners and admins can change a visit time.');
    expect(harness.writes).toBe(0);
    expect(harness.applyTime).not.toHaveBeenCalled();
    expect(harness.notifyReschedule).not.toHaveBeenCalled();
    expect(harness.notifyMove).not.toHaveBeenCalled();
  });

  it('still saves when the time email throws', async () => {
    harness.notifyReschedule.mockRejectedValue(new Error('resend down'));
    const result = await updateScheduledVisitTimes(
      {},
      form({
        tenant_slug: 'acme',
        visit_id: 'visit-1',
        starts_at: '2026-06-09T10:00',
        ends_at: '2026-06-09T12:00',
      }),
    );
    expect(result.success).toBe(true);
    expect(harness.notifyReschedule).toHaveBeenCalledTimes(1);
  });
});
