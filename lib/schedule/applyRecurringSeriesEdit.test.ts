import { describe, expect, it } from 'vitest';
import {
  commitRecurringSeriesSplit,
  type SeriesSplitCommit,
} from '@/lib/schedule/applyRecurringSeriesEdit';

type Rule = {
  id: string;
  tenant_id: string;
  is_active: boolean;
  rrule_definition: string;
  title: string;
};

type Visit = {
  id: string;
  tenant_id: string;
  recurring_rule_id: string | null;
  starts_at: string;
  ends_at: string;
  title: string;
  notes: string | null;
  expected_amount_cents: number | null;
  staffing_status: 'assigned';
};

type Skip = { recurring_rule_id: string; starts_at: string; visit_id: string | null };

function snapshot(state: {
  rules: Rule[];
  visits: Visit[];
  assignees: Map<string, string[]>;
  skips: Skip[];
}) {
  const omitClock = (row: object) => {
    const copy = { ...row } as { updated_at?: string };
    delete copy.updated_at;
    return copy;
  };
  return JSON.stringify({
    rules: state.rules.map((row) => omitClock(row)),
    visits: state.visits.map((row) => omitClock(row)),
    assignees: [...state.assignees.entries()],
    skips: state.skips,
  });
}

function memoryClient(failOn: { table: string; op: string; nth: number } | null) {
  const state = {
    rules: [
      {
        id: 'rule-old',
        tenant_id: 'tenant-1',
        is_active: true,
        rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
        title: 'Weekly',
      },
    ] as Rule[],
    visits: [
      {
        id: 'v1',
        tenant_id: 'tenant-1',
        recurring_rule_id: 'rule-old',
        starts_at: '2026-06-08T13:00:00.000Z',
        ends_at: '2026-06-08T15:00:00.000Z',
        title: 'Weekly',
        notes: null,
        expected_amount_cents: 1000,
        staffing_status: 'assigned' as const,
      },
      {
        id: 'v2',
        tenant_id: 'tenant-1',
        recurring_rule_id: 'rule-old',
        starts_at: '2026-06-15T13:00:00.000Z',
        ends_at: '2026-06-15T15:00:00.000Z',
        title: 'Weekly',
        notes: null,
        expected_amount_cents: 1000,
        staffing_status: 'assigned' as const,
      },
    ] as Visit[],
    assignees: new Map<string, string[]>([
      ['v1', ['cleaner-1']],
      ['v2', ['cleaner-1']],
    ]),
    skips: [] as Skip[],
  };
  const before = snapshot(state);
  const seen = new Map<string, number>();

  function finish(table: string, op: string, payload: unknown, filters: Record<string, string>) {
    const key = `${table}:${op}`;
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    if (failOn && failOn.table === table && failOn.op === op && failOn.nth === nth) {
      return { data: null, error: { message: 'boom' } };
    }
    if (table === 'recurring_appointment_rules' && op === 'insert') {
      state.rules.push(payload as Rule);
      return { data: { id: (payload as Rule).id }, error: null };
    }
    if (table === 'recurring_appointment_rules' && op === 'update') {
      const rule = state.rules.find(
        (row) => row.id === filters.id && row.tenant_id === filters.tenant_id,
      );
      if (rule) Object.assign(rule, payload);
      return { data: null, error: null };
    }
    if (table === 'recurring_appointment_rules' && op === 'delete') {
      state.rules = state.rules.filter(
        (row) => !(row.id === filters.id && row.tenant_id === filters.tenant_id),
      );
      return { data: null, error: null };
    }
    if (table === 'tenant_scheduled_visits' && op === 'update') {
      const visit = state.visits.find((row) => {
        if (row.id !== filters.id || row.tenant_id !== filters.tenant_id) return false;
        if (filters.recurring_rule_id && row.recurring_rule_id !== filters.recurring_rule_id)
          return false;
        return true;
      });
      if (visit) Object.assign(visit, payload);
      return { data: null, error: null };
    }
    if (table === 'tenant_scheduled_visit_assignees' && op === 'delete') {
      const visitId = filters.visit_id;
      if (!visitId) return { data: null, error: { message: 'missing visit' } };
      state.assignees.set(visitId, []);
      return { data: null, error: null };
    }
    if (table === 'tenant_scheduled_visit_assignees' && op === 'insert') {
      for (const row of payload as Array<{ visit_id: string; user_id: string }>) {
        const list = state.assignees.get(row.visit_id) ?? [];
        list.push(row.user_id);
        state.assignees.set(row.visit_id, list);
      }
      return { data: null, error: null };
    }
    if (table === 'recurring_appointment_occurrence_skips' && op === 'upsert') {
      state.skips.push(...(payload as Skip[]));
      return { data: null, error: null };
    }
    if (table === 'recurring_appointment_occurrence_skips' && op === 'delete') {
      state.skips = state.skips.filter(
        (row) =>
          !(
            row.recurring_rule_id === filters.recurring_rule_id &&
            row.starts_at === filters.starts_at
          ),
      );
      return { data: null, error: null };
    }
    return { data: null, error: { message: `unexpected ${key}` } };
  }

  function terminal(table: string, op: string, payload: unknown) {
    const filters: Record<string, string> = {};
    const self = {
      select() {
        return self;
      },
      eq(column: string, value: string) {
        filters[column] = value;
        return self;
      },
      single: async () => finish(table, op, payload, filters),
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(finish(table, op, payload, filters)).then(resolve, reject);
      },
    };
    return self;
  }

  const admin = {
    from(table: string) {
      return {
        insert: (payload: unknown) => terminal(table, 'insert', payload),
        update: (payload: unknown) => terminal(table, 'update', payload),
        delete: () => terminal(table, 'delete', null),
        upsert: (payload: unknown) => terminal(table, 'upsert', payload),
      };
    },
  };

  return { admin, state, before };
}

function commitInput(): SeriesSplitCommit {
  return {
    tenantId: 'tenant-1',
    newRule: {
      id: 'rule-new',
      tenant_id: 'tenant-1',
      customer_id: 'cust-1',
      title: 'Weekly',
      rrule_definition: 'FREQ=WEEKLY;BYDAY=TU;INTERVAL=1',
      anchor_starts_at: '2026-06-09T14:00:00.000Z',
      visit_duration_minutes: 120,
      horizon_days: 60,
      is_active: true,
    },
    oldRuleId: 'rule-old',
    oldRulePatch: {
      rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1;UNTIL=20260608T125959Z',
      is_active: true,
      updated_at: '2026-06-01T00:00:00.000Z',
    },
    visitPatches: [
      {
        id: 'v1',
        update: {
          recurring_rule_id: 'rule-new',
          starts_at: '2026-06-09T14:00:00.000Z',
          ends_at: '2026-06-09T16:00:00.000Z',
        },
      },
      {
        id: 'v2',
        update: {
          recurring_rule_id: 'rule-new',
          starts_at: '2026-06-16T14:00:00.000Z',
          ends_at: '2026-06-16T16:00:00.000Z',
        },
      },
    ],
    replaceCrew: [
      { visitId: 'v1', userIds: ['cleaner-2'] },
      { visitId: 'v2', userIds: ['cleaner-2'] },
    ],
    skips: [
      {
        recurring_rule_id: 'rule-old',
        starts_at: '2026-06-08T13:00:00.000Z',
        visit_id: 'v1',
      },
    ],
    restoreVisits: [
      {
        id: 'v1',
        recurring_rule_id: 'rule-old',
        starts_at: '2026-06-08T13:00:00.000Z',
        ends_at: '2026-06-08T15:00:00.000Z',
        title: 'Weekly',
        notes: null,
        expected_amount_cents: 1000,
        staffing_status: 'assigned',
      },
      {
        id: 'v2',
        recurring_rule_id: 'rule-old',
        starts_at: '2026-06-15T13:00:00.000Z',
        ends_at: '2026-06-15T15:00:00.000Z',
        title: 'Weekly',
        notes: null,
        expected_amount_cents: 1000,
        staffing_status: 'assigned',
      },
    ],
    restoreAssignees: [
      { visitId: 'v1', userIds: ['cleaner-1'] },
      { visitId: 'v2', userIds: ['cleaner-1'] },
    ],
  };
}

describe('commitRecurringSeriesSplit', () => {
  it('rolls back a new series when a later visit write fails', async () => {
    const db = memoryClient({ table: 'tenant_scheduled_visits', op: 'update', nth: 2 });
    const result = await commitRecurringSeriesSplit(db.admin as never, commitInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('boom');
    expect(snapshot(db.state)).toBe(db.before);
  });

  it('rolls back visits, crew, and skips when closing the old series fails', async () => {
    const db = memoryClient({ table: 'recurring_appointment_rules', op: 'update', nth: 1 });
    const result = await commitRecurringSeriesSplit(db.admin as never, commitInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('boom');
    expect(snapshot(db.state)).toBe(db.before);
    expect(db.state.rules.map((rule) => rule.id)).toEqual(['rule-old']);
    expect(db.state.rules[0]?.is_active).toBe(true);
    expect(db.state.visits.every((visit) => visit.recurring_rule_id === 'rule-old')).toBe(true);
    expect(db.state.skips).toEqual([]);
    expect(db.state.assignees.get('v1')).toEqual(['cleaner-1']);
  });
});
