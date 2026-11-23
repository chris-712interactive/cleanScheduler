import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  notify: vi.fn(async (admin: unknown, params: unknown) => {
    void admin;
    void params;
    return { emailed: 1, skipped: 'none' as const };
  }),
  payload: {
    ok: true,
    finalized: true,
    visit_id: 'visit-1',
    recurring_rule_id: 'rule-1' as string | null,
  },
  rule: {
    id: 'rule-1',
    customer_id: 'cust-1',
    title: 'Weekly clean',
    rrule_definition: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
    anchor_starts_at: '2026-06-08T13:00:00.000Z',
  } as null | Record<string, string>,
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

function queryResult(data: unknown) {
  const resolved = { data, error: null };
  const self: Record<string, unknown> = {};
  const proxy = new Proxy(self, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown) => Promise.resolve(resolved).then(resolve);
      }
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve(resolved);
      return () => proxy;
    },
  });
  return proxy;
}

function admin() {
  return {
    rpc: async () => ({ data: harness.payload, error: null }),
    from(table: string) {
      if (table === 'recurring_appointment_rules') return queryResult(harness.rule);
      if (table === 'tenant_scheduled_visit_assignees') return queryResult([]);
      return queryResult(null);
    },
  };
}

import { finalizeInstantBookingRecord } from '@/lib/booking/confirmInstantBooking';

describe('instant booking series email', () => {
  beforeEach(() => {
    harness.notify.mockClear();
    harness.payload = {
      ok: true,
      finalized: true,
      visit_id: 'visit-1',
      recurring_rule_id: 'rule-1',
    };
    harness.rule = {
      id: 'rule-1',
      customer_id: 'cust-1',
      title: 'Weekly clean',
      rrule_definition: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
      anchor_starts_at: '2026-06-08T13:00:00.000Z',
    };
  });

  it('sends the series-created email once when finalize creates a recurring rule', async () => {
    const result = await finalizeInstantBookingRecord(admin() as never, 'tenant-1', 'booking-1');
    expect(result).toMatchObject({ finalized: true, recurringRuleId: 'rule-1' });
    expect(harness.notify).toHaveBeenCalledTimes(1);
    expect(harness.notify.mock.calls[0]?.[1]).toMatchObject({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      ruleId: 'rule-1',
      action: 'created',
    });
  });

  it('does not send a series email for a one-time booking or a finalize retry', async () => {
    harness.payload = { ...harness.payload, recurring_rule_id: null };
    await finalizeInstantBookingRecord(admin() as never, 'tenant-1', 'booking-1');
    expect(harness.notify).not.toHaveBeenCalled();

    harness.payload = {
      ok: true,
      finalized: false,
      visit_id: 'visit-1',
      recurring_rule_id: 'rule-1',
    };
    await finalizeInstantBookingRecord(admin() as never, 'tenant-1', 'booking-1');
    expect(harness.notify).not.toHaveBeenCalled();
  });
});
