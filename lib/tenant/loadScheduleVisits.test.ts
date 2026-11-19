import { describe, expect, it } from 'vitest';
import { loadScheduleVisits } from '@/lib/tenant/loadScheduleVisits';

describe('loadScheduleVisits missing route_sequence', () => {
  it('retries without the column for the day, week, and field schedule', async () => {
    const selects: string[] = [];
    const chain = {
      select(value: string) {
        selects.push(value);
        return chain;
      },
      eq() {
        return chain;
      },
      lte() {
        return chain;
      },
      gte() {
        return chain;
      },
      order() {
        return chain;
      },
      overrideTypes() {
        const sql = selects[selects.length - 1] ?? '';
        if (/\broute_sequence\b/.test(sql)) {
          return Promise.resolve({
            data: null,
            error: {
              code: '42703',
              message: 'column tenant_scheduled_visits.route_sequence does not exist',
            },
          });
        }
        return Promise.resolve({
          data: [
            {
              id: 'visit-1',
              title: 'Morning clean',
              starts_at: '2026-06-01T14:00:00.000Z',
              ends_at: '2026-06-01T15:00:00.000Z',
              status: 'scheduled',
              visit_purpose: 'service',
              notes: null,
              expected_amount_cents: null,
              checked_in_at: null,
              customers: null,
              tenant_customer_properties: null,
              tenant_quotes: null,
              tenant_scheduled_visit_assignees: [{ user_id: 'cleaner-1', user_profiles: null }],
            },
          ],
          error: null,
        });
      },
    };
    const supabase = { from: () => chain };
    const day = await loadScheduleVisits({
      supabase: supabase as never,
      tenantId: 'tenant-1',
      dateKey: '2026-06-01',
      view: 'day',
    });
    const week = await loadScheduleVisits({
      supabase: supabase as never,
      tenantId: 'tenant-1',
      dateKey: '2026-06-01',
      view: 'week',
      fieldEmployeeMode: true,
      currentUserId: 'cleaner-1',
    });
    expect(selects.length).toBeGreaterThanOrEqual(2);
    expect(selects.some((sql) => !/\broute_sequence\b/.test(sql))).toBe(true);
    expect(day.visits[0]?.routeSequence).toBeNull();
    expect(day.visits[0]?.title).toBe('Morning clean');
    expect(week.visits.map((visit) => visit.id)).toEqual(['visit-1']);
  });
});
