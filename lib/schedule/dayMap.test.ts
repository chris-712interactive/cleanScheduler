import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldEmployeeCanAccessBrowserPath } from '@/lib/tenant/fieldEmployeeAccess';
import {
  DAY_MAP_DEFAULT_STYLE_URL,
  DAY_MAP_STYLE_FAILURE,
  DAY_MAP_UNASSIGNED_COLOR,
  dayMapMissingReasonLabel,
  dayMapStyleFailureNote,
  dayMapStyleNotice,
  formatDayMapDateLabel,
  resolveDayMapStyleUrl,
  shapeDayMap,
  type DayMapVisitRow,
} from '@/lib/schedule/dayMap';
import { isCalendarDateKey, normalizeDateKey } from '@/lib/tenant/scheduleDateRange';
import { DAY_MAP_VISIT_SELECT, loadDayMap } from '@/lib/schedule/loadDayMap';
import { dbOverlapRangeForQuery } from '@/lib/tenant/scheduleDateRange';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const VISIT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VISIT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VISIT_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CUST = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ALEX = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const JORDAN = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function property(
  overrides: Partial<NonNullable<DayMapVisitRow['tenant_customer_properties']>> = {},
) {
  return {
    tenant_id: TENANT,
    is_primary: true,
    address_line1: '1 Main St',
    address_line2: null,
    city: 'Austin',
    state: 'TX',
    postal_code: '78701',
    latitude: 30.27,
    longitude: -97.74,
    geocode_reason: null,
    ...overrides,
  };
}

function row(overrides: Partial<DayMapVisitRow> = {}): DayMapVisitRow {
  return {
    id: VISIT_A,
    tenant_id: TENANT,
    customer_id: CUST,
    property_id: '99999999-9999-4999-8999-999999999999',
    title: 'Weekly clean',
    starts_at: '2026-06-01T13:00:00.000Z',
    ends_at: '2026-06-01T15:00:00.000Z',
    status: 'scheduled',
    customers: {
      customer_identities: { first_name: 'Pat', last_name: 'Lee', full_name: 'Pat Lee' },
      tenant_customer_properties: [],
    },
    tenant_customer_properties: property(),
    tenant_scheduled_visit_assignees: [
      { user_id: ALEX, user_profiles: { display_name: 'Alex Rivera' } },
    ],
    ...overrides,
  };
}

const base = {
  tenantId: TENANT,
  dateKey: '2026-06-01',
  timeZone: 'America/New_York',
};

describe('shapeDayMap', () => {
  it('groups pins by the assigned cleaner and shares one color', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row(),
        row({
          id: VISIT_B,
          starts_at: '2026-06-01T16:00:00.000Z',
          ends_at: '2026-06-01T17:00:00.000Z',
          tenant_customer_properties: property({ latitude: 30.3, longitude: -97.7 }),
        }),
        row({
          id: VISIT_C,
          starts_at: '2026-06-01T18:00:00.000Z',
          ends_at: '2026-06-01T19:00:00.000Z',
          tenant_customer_properties: property({ latitude: 30.4, longitude: -97.8 }),
          tenant_scheduled_visit_assignees: [
            { user_id: JORDAN, user_profiles: { display_name: 'Jordan Kim' } },
          ],
          customers: {
            customer_identities: { first_name: 'Sam', last_name: 'Ortiz', full_name: null },
            tenant_customer_properties: [],
          },
        }),
      ],
    });

    expect(model.pins.map((pin) => pin.customerName)).toEqual(['Pat Lee', 'Pat Lee', 'Sam Ortiz']);
    expect(model.pins[0]?.timeLabel).toBe('9:00 AM – 11:00 AM');
    expect(model.pins[0]?.href).toBe(`/schedule/${VISIT_A}`);
    expect(model.groups.map((group) => [group.label, group.visitCount])).toEqual([
      ['Alex Rivera', 2],
      ['Jordan Kim', 1],
    ]);
    expect(model.pins[0]?.color).toBe(model.pins[1]?.color);
    expect(model.pins[2]?.color).not.toBe(model.pins[0]?.color);
    expect(model.missing).toEqual([]);
  });

  it('colors a shared visit by the first cleaner name and lists everyone', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({
          tenant_scheduled_visit_assignees: [
            { user_id: JORDAN, user_profiles: { display_name: 'Jordan Kim' } },
            { user_id: ALEX, user_profiles: { display_name: 'Alex Rivera' } },
          ],
        }),
      ],
    });

    expect(model.pins[0]?.assigneeLabel).toBe('Alex Rivera, Jordan Kim');
    expect(model.groups).toEqual([
      expect.objectContaining({ id: `cleaner:${ALEX}`, label: 'Alex Rivera', visitCount: 1 }),
    ]);
  });

  it('puts unassigned visits in their own legend group after named cleaners', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({
          id: VISIT_B,
          starts_at: '2026-06-01T12:00:00.000Z',
          ends_at: '2026-06-01T13:00:00.000Z',
          tenant_scheduled_visit_assignees: [],
        }),
        row(),
      ],
    });

    expect(model.groups.map((group) => group.label)).toEqual(['Alex Rivera', 'Unassigned']);
    expect(model.groups[1]?.color).toBe(DAY_MAP_UNASSIGNED_COLOR);
    expect(model.pins.find((pin) => pin.visitId === VISIT_B)?.assigneeLabel).toBe('Unassigned');
  });

  it('lists visits with no point and the geocode reason', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({
          id: VISIT_A,
          tenant_customer_properties: property({
            latitude: null,
            longitude: null,
            geocode_reason: 'no_match',
          }),
        }),
        row({
          id: VISIT_B,
          starts_at: '2026-06-01T16:00:00.000Z',
          ends_at: '2026-06-01T17:00:00.000Z',
          tenant_customer_properties: property({
            latitude: null,
            longitude: null,
            geocode_reason: 'lookup_failed',
          }),
        }),
        row({
          id: VISIT_C,
          starts_at: '2026-06-01T18:00:00.000Z',
          ends_at: '2026-06-01T19:00:00.000Z',
          property_id: null,
          tenant_customer_properties: null,
          customers: {
            customer_identities: { first_name: 'No', last_name: 'Site', full_name: null },
            tenant_customer_properties: [],
          },
        }),
      ],
    });

    expect(model.pins).toEqual([]);
    expect(model.missing.map((item) => item.reasonLabel)).toEqual([
      "Couldn't locate this address",
      'Lookup will retry',
      'No service location',
    ]);
    expect(model.missing[0]?.customerHref).toBe(`/customers/${CUST}`);
    expect(model.missing[0]?.siteLine).toContain('1 Main St');
  });

  it('does not borrow another property point when the visit location missed', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({
          tenant_customer_properties: property({
            latitude: null,
            longitude: null,
            geocode_reason: 'no_match',
            address_line1: '9 Visit St',
          }),
          customers: {
            customer_identities: { first_name: 'Pat', last_name: 'Lee', full_name: null },
            tenant_customer_properties: [property({ address_line1: '9 Other St', latitude: 30.1 })],
          },
        }),
      ],
    });

    expect(model.pins).toEqual([]);
    expect(model.missing[0]?.siteLine).toContain('9 Visit St');
    expect(model.missing[0]?.reasonLabel).toBe("Couldn't locate this address");
  });

  it('uses the primary customer location when the visit has no property', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({
          property_id: null,
          tenant_customer_properties: null,
          customers: {
            customer_identities: { first_name: 'Pat', last_name: 'Lee', full_name: null },
            tenant_customer_properties: [
              property({
                is_primary: false,
                address_line1: '2 Side St',
                latitude: 1,
                longitude: 2,
              }),
              property({
                is_primary: true,
                address_line1: '3 Home St',
                latitude: 30.5,
                longitude: -97.5,
              }),
            ],
          },
        }),
      ],
    });

    expect(model.missing).toEqual([]);
    expect(model.pins[0]?.siteLine).toContain('3 Home St');
    expect(model.pins[0]?.latitude).toBe(30.5);
  });

  it('drops another workspace, cancelled visits, and the wrong local day', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({ id: VISIT_A, tenant_id: OTHER }),
        row({ id: VISIT_B, status: 'cancelled' }),
        row({
          id: VISIT_C,
          starts_at: '2026-06-02T16:00:00.000Z',
          ends_at: '2026-06-02T17:00:00.000Z',
        }),
      ],
    });

    expect(model.pins).toEqual([]);
    expect(model.missing).toEqual([]);

    const evening = shapeDayMap({
      tenantId: TENANT,
      dateKey: '2026-06-01',
      timeZone: 'America/New_York',
      rows: [
        row({
          starts_at: '2026-06-02T01:30:00.000Z',
          ends_at: '2026-06-02T02:30:00.000Z',
        }),
      ],
    });
    expect(evening.pins).toHaveLength(1);
    expect(evening.pins[0]?.timeLabel).toBe('9:30 PM – 10:30 PM');
  });

  it('ignores a point that belongs to another workspace', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({
          tenant_customer_properties: property({
            tenant_id: OTHER,
            latitude: 40,
            longitude: -70,
            geocode_reason: 'no_match',
          }),
        }),
      ],
    });

    expect(model.pins).toEqual([]);
    expect(model.missing[0]?.reasonLabel).toBe('Missing map point');
  });

  it('treats an out-of-range coordinate as missing', () => {
    const model = shapeDayMap({
      ...base,
      rows: [row({ tenant_customer_properties: property({ latitude: 91, longitude: -97 }) })],
    });
    expect(model.pins).toEqual([]);
    expect(model.missing[0]?.reasonLabel).toBe('Missing map point');
  });

  it('offsets pins that share a coordinate', () => {
    const model = shapeDayMap({
      ...base,
      rows: [
        row({ id: VISIT_A }),
        row({
          id: VISIT_B,
          starts_at: '2026-06-01T16:00:00.000Z',
          ends_at: '2026-06-01T17:00:00.000Z',
        }),
      ],
    });
    expect(model.pins[0]?.latitude).toBe(model.pins[1]?.latitude);
    expect([model.pins[0]?.pinLatitude, model.pins[0]?.pinLongitude]).not.toEqual([
      model.pins[1]?.pinLatitude,
      model.pins[1]?.pinLongitude,
    ]);
  });

  it('refuses a visit id that is not a uuid in the link', () => {
    const model = shapeDayMap({
      ...base,
      rows: [row({ id: 'not-a-visit' })],
    });
    expect(model.pins[0]?.href).toBe('/schedule');
  });
});

describe('day map style url', () => {
  it('uses OpenFreeMap when unset and rejects Mapbox and Google hosts', () => {
    expect(resolveDayMapStyleUrl(undefined)).toBe(DAY_MAP_DEFAULT_STYLE_URL);
    expect(resolveDayMapStyleUrl('  ')).toBe(DAY_MAP_DEFAULT_STYLE_URL);
    expect(resolveDayMapStyleUrl('not a url')).toBe(DAY_MAP_DEFAULT_STYLE_URL);
    expect(resolveDayMapStyleUrl('http://tiles.example.com/style.json')).toBe(
      DAY_MAP_DEFAULT_STYLE_URL,
    );
    expect(
      resolveDayMapStyleUrl('https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=pk'),
    ).toBe(DAY_MAP_DEFAULT_STYLE_URL);
    expect(resolveDayMapStyleUrl('https://maps.googleapis.com/maps/api/js')).toBe(
      DAY_MAP_DEFAULT_STYLE_URL,
    );
    expect(resolveDayMapStyleUrl('https://tiles.example.com/style.json')).toBe(
      'https://tiles.example.com/style.json',
    );
    expect(dayMapStyleNotice(DAY_MAP_DEFAULT_STYLE_URL)).toContain('OpenFreeMap');
    expect(dayMapStyleNotice('https://tiles.example.com/style.json')).toContain(
      'NEXT_PUBLIC_MAP_STYLE_URL',
    );
  });
});

describe('day map copy', () => {
  it('formats the office date and the short geocode reasons', () => {
    expect(formatDayMapDateLabel('2026-06-01')).toBe('Monday, June 1, 2026');
    expect(formatDayMapDateLabel('2026-02-31')).toBe('2026-02-31');
    expect(dayMapMissingReasonLabel({ hasProperty: true, geocodeReason: 'no_match' })).toBe(
      "Couldn't locate this address",
    );
    expect(dayMapMissingReasonLabel({ hasProperty: true, geocodeReason: 'lookup_failed' })).toBe(
      'Lookup will retry',
    );
    expect(dayMapMissingReasonLabel({ hasProperty: false, geocodeReason: null })).toBe(
      'No service location',
    );
  });
});

describe('calendar date keys', () => {
  it('keeps a real day and falls back when the calendar day is impossible', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isCalendarDateKey('2026-06-01')).toBe(true);
    expect(isCalendarDateKey('2024-02-29')).toBe(true);
    expect(normalizeDateKey('2026-06-01')).toBe('2026-06-01');
    expect(isCalendarDateKey('2026-02-29')).toBe(false);

    for (const raw of [
      'not-a-date',
      '2026-13-01',
      '2026-00-01',
      '0000-00-00',
      '9999-99-99',
      '2026-02-31',
    ]) {
      expect(normalizeDateKey(raw)).toBe(today);
    }

    const key = normalizeDateKey('2026-02-31');
    expect(formatDayMapDateLabel(key)).toBe(formatDayMapDateLabel(today));
    expect(formatDayMapDateLabel(key)).not.toContain('March');
    expect(() => dbOverlapRangeForQuery('day', key)).not.toThrow();
  });
});

describe('day map style errors', () => {
  it('names a style that has not loaded and stays quiet after it has', () => {
    expect(dayMapStyleFailureNote(false)).toBe(DAY_MAP_STYLE_FAILURE);
    expect(dayMapStyleFailureNote(true)).toBeNull();
  });
});

describe('day map access', () => {
  it('keeps the day map off the field employee schedule', () => {
    expect(fieldEmployeeCanAccessBrowserPath('/schedule/map')).toBe(false);
    expect(fieldEmployeeCanAccessBrowserPath('/schedule/map?date=2026-06-01')).toBe(false);
    expect(fieldEmployeeCanAccessBrowserPath('/schedule')).toBe(true);
  });
});

describe('loadDayMap', () => {
  it('queries only the requested workspace and shapes those rows', async () => {
    const calls: Array<[string, string, string]> = [];
    const foreign = row({ id: VISIT_B, tenant_id: OTHER });
    const own = row();
    const chain = {
      select(value: string) {
        expect(value).toBe(DAY_MAP_VISIT_SELECT);
        return chain;
      },
      eq(column: string, value: string) {
        calls.push(['eq', column, value]);
        return chain;
      },
      neq(column: string, value: string) {
        calls.push(['neq', column, value]);
        return chain;
      },
      lte(column: string, value: string) {
        calls.push(['lte', column, value]);
        return chain;
      },
      gte(column: string, value: string) {
        calls.push(['gte', column, value]);
        return chain;
      },
      order() {
        return chain;
      },
      overrideTypes() {
        return Promise.resolve({ data: [foreign, own], error: null });
      },
    };
    const supabase = {
      from(table: string) {
        expect(table).toBe('tenant_scheduled_visits');
        return chain;
      },
    };

    const model = await loadDayMap({
      supabase: supabase as never,
      tenantId: TENANT,
      dateKey: '2026-06-01',
      timeZone: 'America/New_York',
    });

    const range = dbOverlapRangeForQuery('day', '2026-06-01');
    expect(calls).toEqual([
      ['eq', 'tenant_id', TENANT],
      ['neq', 'status', 'cancelled'],
      ['lte', 'starts_at', range.end],
      ['gte', 'ends_at', range.start],
    ]);
    expect(model.pins.map((pin) => pin.visitId)).toEqual([VISIT_A]);
    expect(DAY_MAP_VISIT_SELECT).toContain('geocode_reason');
    expect(DAY_MAP_VISIT_SELECT).not.toContain('user_metadata');
  });

  it('loads the day map when route_sequence is not in the database yet', async () => {
    const selects: string[] = [];
    const chain = {
      select(value: string) {
        selects.push(value);
        return chain;
      },
      eq() {
        return chain;
      },
      neq() {
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
        return Promise.resolve({ data: [row()], error: null });
      },
    };
    const model = await loadDayMap({
      supabase: { from: () => chain } as never,
      tenantId: TENANT,
      dateKey: '2026-06-01',
      timeZone: 'America/New_York',
    });
    expect(selects).toHaveLength(2);
    expect(selects[1]).not.toMatch(/\broute_sequence\b/);
    expect(model.pins.map((pin) => pin.visitId)).toEqual([VISIT_A]);
  });

  it('throws the query error and refuses a blank workspace', async () => {
    const supabase = {
      from() {
        return {
          select: () => supabase.from(),
          eq: () => supabase.from(),
          neq: () => supabase.from(),
          lte: () => supabase.from(),
          gte: () => supabase.from(),
          order: () => supabase.from(),
          overrideTypes: () => Promise.resolve({ data: null, error: { message: 'db down' } }),
        };
      },
    };
    await expect(
      loadDayMap({
        supabase: supabase as never,
        tenantId: TENANT,
        dateKey: '2026-06-01',
        timeZone: 'America/New_York',
      }),
    ).rejects.toThrow('db down');
    await expect(
      loadDayMap({
        supabase: supabase as never,
        tenantId: '  ',
        dateKey: '2026-06-01',
        timeZone: 'America/New_York',
      }),
    ).rejects.toThrow(/workspace/i);
  });
});

describe('maplibre import boundary', () => {
  it('imports maplibre only from the day map canvas', () => {
    const root = process.cwd();
    const hits: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|scss)$/.test(entry) || entry.endsWith('.test.ts')) continue;
        const text = readFileSync(full, 'utf8');
        if (text.includes("from 'maplibre-gl'") || text.includes('maplibre-gl/dist')) {
          hits.push(path.relative(root, full));
        }
      }
    }

    walk(path.join(root, 'app'));
    walk(path.join(root, 'lib'));
    expect(hits).toEqual(['app/tenant/schedule/map/DayMapCanvas.tsx']);
  });
});
