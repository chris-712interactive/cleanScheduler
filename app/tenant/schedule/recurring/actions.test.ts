import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  notify: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1, skipped: 'none' as const };
  }),
  insertError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  updateRow: {
    id: 'rule-1',
    customer_id: 'cust-1',
    title: 'Weekly clean',
    rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
    anchor_starts_at: '2026-06-01T13:00:00.000Z',
  } as null | Record<string, unknown>,
  recentSeries: [] as Array<{
    id: string;
    created_at: string;
    rrule_definition: string;
    anchor_starts_at: string;
  }>,
  inserts: 0,
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
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

vi.mock('@/lib/billing/automationWorkflows', () => ({
  assertTenantCanCreateAutomationWorkflow: async () => {},
  automationWorkflowGateErrorMessage: () => 'limit',
}));

vi.mock('@/lib/billing/resolveVisitExpectedAmount', () => ({
  resolveScheduleJobPriceCents: async () => ({ expectedAmountCents: 15000 }),
}));

vi.mock('@/lib/email/recurringSeriesNotifications', () => ({
  notifyCustomerRecurringSeries: (admin: unknown, params: unknown) => harness.notify(admin, params),
}));

vi.mock('@/lib/email/notifyCleanerScheduleChanges', () => ({
  queueCleanerScheduleNotice: () => {},
}));

vi.mock('@/lib/schedule/loadCleanerScheduleVisits', () => ({
  loadCleanerScheduleVisitSnapshots: async () => ({ ok: true, visits: [] }),
}));

vi.mock('@/lib/schedule/replaceRecurringSeriesCrew', () => ({
  replaceFutureRecurringSeriesCrew: async () => ({
    ok: true,
    visitIds: [],
    changed: false,
    stored: true,
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      let op = 'select';
      const self: Record<string, unknown> = {};
      const proxy = new Proxy(self, {
        get(_target, prop) {
          if (prop === 'insert' || prop === 'update') {
            return () => {
              op = String(prop);
              if (prop === 'insert' && table === 'recurring_appointment_rules')
                harness.inserts += 1;
              return proxy;
            };
          }
          if (prop === 'maybeSingle' || prop === 'single') {
            return async () => result(false);
          }
          if (prop === 'then') {
            return (resolve: (value: unknown) => unknown) =>
              Promise.resolve(result(true)).then(resolve);
          }
          return () => proxy;
        },
      });

      function result(list: boolean) {
        if (table === 'customers') return { data: { id: 'cust-1' }, error: null };
        if (table === 'tenants') return { data: { timezone: 'America/New_York' }, error: null };
        if (table === 'recurring_appointment_rules' && op === 'insert') {
          return harness.insertError
            ? { data: null, error: harness.insertError }
            : {
                data: {
                  id: 'rule-1',
                  title: 'Weekly clean',
                  rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
                  anchor_starts_at: '2026-06-01T13:00:00.000Z',
                },
                error: null,
              };
        }
        if (table === 'recurring_appointment_rules' && op === 'select' && list) {
          return { data: harness.recentSeries, error: null };
        }
        if (table === 'recurring_appointment_rules' && op === 'update') {
          return harness.updateError
            ? { data: null, error: harness.updateError }
            : { data: harness.updateRow, error: null };
        }
        if (table === 'recurring_appointment_rules') {
          return {
            data: {
              id: 'rule-1',
              customer_id: 'cust-1',
              title: 'Weekly clean',
              rrule_definition: 'FREQ=WEEKLY;BYDAY=TU;INTERVAL=1',
              anchor_starts_at: '2026-06-02T13:00:00.000Z',
              is_active: true,
            },
            error: null,
          };
        }
        return { data: [], error: null };
      }

      return proxy;
    },
  }),
}));

import {
  createRecurringVisitRuleAction,
  deactivateRecurringVisitRuleAction,
  updateRecurringVisitRuleAction,
} from '@/app/tenant/schedule/recurring/actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function capture(run: () => Promise<void>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('REDIRECT:')) return message.slice('REDIRECT:'.length);
    throw error;
  }
  return '';
}

describe('recurring series actions do not email a failed write', () => {
  beforeEach(() => {
    harness.notify.mockClear();
    harness.insertError = null;
    harness.updateError = null;
    harness.recentSeries = [];
    harness.inserts = 0;
    harness.updateRow = {
      id: 'rule-1',
      customer_id: 'cust-1',
      title: 'Weekly clean',
      rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
      anchor_starts_at: '2026-06-01T13:00:00.000Z',
    };
  });

  it('does not email when creating the series fails', async () => {
    harness.insertError = { message: 'duplicate' };
    const url = await capture(() =>
      createRecurringVisitRuleAction(
        form({
          tenant_slug: 'acme',
          customer_id: 'cust-1',
          preset: 'weekly_mon',
          starts_at: '2026-06-01T09:00',
          client_timezone_offset: '0',
        }),
      ),
    );
    expect(url).toContain('error=');
    expect(harness.notify).not.toHaveBeenCalled();
  });

  it('emails the customer once after the series is saved', async () => {
    await capture(() =>
      createRecurringVisitRuleAction(
        form({
          tenant_slug: 'acme',
          customer_id: 'cust-1',
          preset: 'weekly_mon',
          starts_at: '2026-06-01T09:00',
          client_timezone_offset: '0',
        }),
      ),
    );
    expect(harness.notify).toHaveBeenCalledTimes(1);
    expect(harness.inserts).toBe(1);
    expect(harness.notify.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      action: 'created',
    });
  });

  it('does not insert or email when the same series was just saved', async () => {
    harness.recentSeries = [
      {
        id: 'rule-existing',
        created_at: new Date().toISOString(),
        rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
        anchor_starts_at: '2026-06-01T09:00:00.000Z',
      },
    ];
    const url = await capture(() =>
      createRecurringVisitRuleAction(
        form({
          tenant_slug: 'acme',
          customer_id: 'cust-1',
          preset: 'weekly_mon',
          starts_at: '2026-06-01T09:00',
          client_timezone_offset: '0',
        }),
      ),
    );
    expect(url).toContain('created=1');
    expect(harness.inserts).toBe(0);
    expect(harness.notify).not.toHaveBeenCalled();
  });

  it('does not email when a series change fails to save', async () => {
    harness.updateError = { message: 'locked' };
    const url = await capture(() =>
      updateRecurringVisitRuleAction(
        form({
          tenant_slug: 'acme',
          rule_id: 'rule-1',
          preset: 'weekly_mon',
          starts_at: '2026-06-02T09:00',
        }),
      ),
    );
    expect(url).toContain('error=');
    expect(harness.notify).not.toHaveBeenCalled();
  });

  it('emails once after a series change is saved', async () => {
    await capture(() =>
      updateRecurringVisitRuleAction(
        form({
          tenant_slug: 'acme',
          rule_id: 'rule-1',
          preset: 'weekly_mon',
          starts_at: '2026-06-02T09:00',
        }),
      ),
    );
    expect(harness.notify).toHaveBeenCalledTimes(1);
    expect(harness.notify.mock.calls[0]?.[1]).toMatchObject({ action: 'changed' });
  });

  it('does not email when cancelling the series fails', async () => {
    harness.updateError = { message: 'locked' };
    const url = await capture(() =>
      deactivateRecurringVisitRuleAction(form({ tenant_slug: 'acme', rule_id: 'rule-1' })),
    );
    expect(url).toContain('error=');
    expect(harness.notify).not.toHaveBeenCalled();
  });

  it('emails once after the series is cancelled', async () => {
    await capture(() =>
      deactivateRecurringVisitRuleAction(form({ tenant_slug: 'acme', rule_id: 'rule-1' })),
    );
    expect(harness.notify).toHaveBeenCalledTimes(1);
    expect(harness.notify.mock.calls[0]?.[1]).toMatchObject({
      action: 'cancelled',
      customerId: 'cust-1',
    });
  });
});
