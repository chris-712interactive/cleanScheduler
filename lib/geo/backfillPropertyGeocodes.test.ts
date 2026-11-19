import { describe, expect, it, vi } from 'vitest';
import {
  propertyNeedsGeocodeBackfill,
  runPropertyGeocodeBackfill,
  type GeocodeBackfillStore,
  type PropertyGeocodeRow,
} from './backfillPropertyGeocodes';
import { parseBackfillArgs } from './backfillPropertyGeocodesCli';
import type { GeocodeResult } from './censusGeocode';
import type { PropertyGeocodePatch } from './propertyGeocodePatch';

const tenantId = '11111111-1111-4111-8111-111111111111';

function row(overrides: Partial<PropertyGeocodeRow> = {}): PropertyGeocodeRow {
  return {
    id: 'property-1',
    tenant_id: tenantId,
    address_line1: '10 Main St',
    city: 'Sylva',
    state: 'NC',
    postal_code: '28779',
    latitude: null,
    longitude: null,
    geocode_status: null,
    geocode_reason: null,
    geocoded_at: null,
    ...overrides,
  };
}

function memoryStore(
  seed: PropertyGeocodeRow[],
): GeocodeBackfillStore & { rows: PropertyGeocodeRow[] } {
  const rows = seed.map((item) => ({ ...item }));
  return {
    rows,
    async list(requestedTenant, offset, limit) {
      return rows
        .filter((item) => item.tenant_id === requestedTenant)
        .slice(offset, offset + limit);
    },
    async save(requestedTenant, current, patch: PropertyGeocodePatch) {
      const found = rows.find(
        (item) => item.id === current.id && item.tenant_id === requestedTenant,
      );
      if (!found) return 'skipped';
      if (
        found.address_line1 !== current.address_line1 ||
        found.city !== current.city ||
        found.state !== current.state ||
        found.postal_code !== current.postal_code
      ) {
        return 'skipped';
      }
      found.latitude = patch.latitude;
      found.longitude = patch.longitude;
      found.geocode_status = patch.geocode_status;
      found.geocode_reason = patch.geocode_reason;
      found.geocoded_at = patch.geocoded_at;
      return 'saved';
    },
  };
}

function okResult(): GeocodeResult {
  return {
    point: { lat: 35.37, lng: -83.22 },
    reason: null,
    status: 'ok',
    source: 'census',
    accuracy: 'address',
    reused: false,
  };
}

describe('property geocode backfill', () => {
  it('skips rows that already have a point or a finished failure', () => {
    expect(propertyNeedsGeocodeBackfill(row())).toBe(true);
    expect(
      propertyNeedsGeocodeBackfill(row({ latitude: 35, longitude: -83, geocode_status: 'ok' })),
    ).toBe(false);
    expect(
      propertyNeedsGeocodeBackfill(
        row({
          geocode_status: 'failed',
          geocode_reason: 'no_match',
          geocoded_at: '2020-01-01T00:00:00.000Z',
        }),
      ),
    ).toBe(false);
    expect(
      propertyNeedsGeocodeBackfill(
        row({ geocode_status: 'failed', geocode_reason: 'no_match' }),
        true,
      ),
    ).toBe(true);
    expect(
      propertyNeedsGeocodeBackfill(
        row({
          geocode_status: 'pending',
          geocode_reason: 'lookup_failed',
          geocoded_at: '2020-01-01T00:00:00.000Z',
        }),
      ),
    ).toBe(true);
    expect(
      propertyNeedsGeocodeBackfill(
        row({
          geocode_status: 'failed',
          geocode_reason: 'lookup_failed',
          geocoded_at: new Date().toISOString(),
        }),
      ),
    ).toBe(false);
    expect(
      propertyNeedsGeocodeBackfill(
        row({ address_line1: 'short', city: null, state: null, postal_code: null }),
      ),
    ).toBe(false);
  });

  it('is idempotent: a second run does not call the provider', async () => {
    const store = memoryStore([
      row({ id: 'needs-point' }),
      row({ id: 'already', latitude: 1, longitude: 2, geocode_status: 'ok' }),
      row({ id: 'other', tenant_id: '22222222-2222-4222-8222-222222222222' }),
    ]);
    const lookup = vi.fn(async () => okResult());
    const sleep = vi.fn(async () => undefined);

    const first = await runPropertyGeocodeBackfill({
      store,
      tenantId,
      lookup,
      sleep,
      minIntervalMs: 1100,
      now: () => '2026-04-01T00:00:00.000Z',
    });

    expect(first.lookedUp).toBe(1);
    expect(first.saved).toBe(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(store.rows.find((item) => item.id === 'needs-point')).toMatchObject({
      latitude: 35.37,
      longitude: -83.22,
      geocode_status: 'ok',
    });

    const second = await runPropertyGeocodeBackfill({
      store,
      tenantId,
      lookup,
      sleep,
      now: () => '2026-04-02T00:00:00.000Z',
    });

    expect(second.lookedUp).toBe(0);
    expect(second.skipped).toBe(2);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('stores an outage as pending and retries it only after the pause', async () => {
    const store = memoryStore([row({ id: 'a' }), row({ id: 'b', address_line1: '11 Oak St' })]);
    const lookup = vi.fn(async () => {
      throw new Error('census down');
    });
    const sleep = vi.fn(async () => undefined);
    const during = () => '2026-04-01T00:00:00.000Z';

    const first = await runPropertyGeocodeBackfill({
      store,
      tenantId,
      lookup,
      sleep,
      minIntervalMs: 50,
      now: during,
    });

    expect(first.failed).toBe(2);
    expect(first.saved).toBe(2);
    expect(store.rows[0]).toMatchObject({
      geocode_status: 'pending',
      geocode_reason: 'lookup_failed',
      latitude: null,
    });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(200);

    const second = await runPropertyGeocodeBackfill({
      store,
      tenantId,
      lookup,
      sleep,
      now: during,
    });
    expect(second.lookedUp).toBe(0);
    expect(lookup).toHaveBeenCalledTimes(2);

    const later = await runPropertyGeocodeBackfill({
      store,
      tenantId,
      lookup,
      sleep,
      now: () => '2026-04-01T00:02:00.000Z',
    });
    expect(later.lookedUp).toBe(2);
    expect(lookup).toHaveBeenCalledTimes(4);
  });

  it('does not write a point when the address changed after it was read', async () => {
    const store = memoryStore([row()]);
    store.save = async () => 'skipped';
    const lookup = vi.fn(async () => okResult());

    const report = await runPropertyGeocodeBackfill({
      store,
      tenantId,
      lookup,
      sleep: async () => undefined,
    });

    expect(report.saved).toBe(0);
    expect(report.skipped).toBe(1);
    expect(store.rows[0]?.latitude).toBeNull();
  });

  it('requires one tenant id', () => {
    expect(parseBackfillArgs([]).ok).toBe(false);
    expect(parseBackfillArgs(['--tenant', 'not-a-uuid']).ok).toBe(false);
    expect(parseBackfillArgs(['--tenant', tenantId, '--retry-failed'])).toEqual({
      ok: true,
      options: { tenantId, minIntervalMs: 1100, retryFailed: true },
    });
  });
});
