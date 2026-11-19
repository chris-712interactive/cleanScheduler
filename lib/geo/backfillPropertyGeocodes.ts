import {
  addressGeocodeIsCurrent,
  addressHasText,
  formatGeocodeQuery,
  lookupUsAddress,
  type GeocodeAddress,
  type GeocodeResult,
} from './censusGeocode';
import { propertyGeocodePatchFromResult, type PropertyGeocodePatch } from './propertyGeocodePatch';

export const DEFAULT_BACKFILL_INTERVAL_MS = 1100;

export type PropertyGeocodeRow = {
  id: string;
  tenant_id: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string | null;
  geocode_reason: string | null;
  geocoded_at: string | null;
};

export type BackfillSaveResult = 'saved' | 'skipped';

export type GeocodeBackfillStore = {
  list(tenantId: string, offset: number, limit: number): Promise<PropertyGeocodeRow[]>;
  save(
    tenantId: string,
    row: PropertyGeocodeRow,
    patch: PropertyGeocodePatch,
  ): Promise<BackfillSaveResult>;
};

export type BackfillReport = {
  examined: number;
  lookedUp: number;
  saved: number;
  skipped: number;
  failed: number;
};

/**
 * Rows with a point, or a terminal miss, are left alone.
 * An outage (`lookup_failed`) is included again after the retry pause.
 * Pass retryFailed to call the provider again for a terminal miss.
 */
export function propertyNeedsGeocodeBackfill(
  row: PropertyGeocodeRow,
  retryFailed = false,
  nowMs = Date.now(),
): boolean {
  const address: GeocodeAddress = {
    line1: row.address_line1,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
  };
  if (!addressHasText(address) || formatGeocodeQuery(address).length < 8) return false;
  if (row.latitude != null && row.longitude != null) return false;
  const current = addressGeocodeIsCurrent(
    address,
    {
      ...address,
      latitude: row.latitude,
      longitude: row.longitude,
      geocodeStatus: row.geocode_status,
      geocodedAt: row.geocoded_at,
      reason: row.geocode_reason,
    },
    nowMs,
  );
  if (!current) return true;
  return retryFailed;
}

export function clampBackfillInterval(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_BACKFILL_INTERVAL_MS;
  return Math.min(10_000, Math.max(200, Math.floor(ms)));
}

function rowAddress(row: PropertyGeocodeRow): GeocodeAddress {
  return {
    line1: row.address_line1,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: 'US',
  };
}

/**
 * One tenant, one address at a time. A second run with the same stored
 * outcomes does not call the provider again unless retryFailed is set.
 * Lookup errors are stored as failures and do not stop the rest of the tenant.
 */
export async function runPropertyGeocodeBackfill(options: {
  store: GeocodeBackfillStore;
  tenantId: string;
  lookup?: (address: GeocodeAddress) => Promise<GeocodeResult>;
  sleep?: (ms: number) => Promise<void>;
  minIntervalMs?: number;
  retryFailed?: boolean;
  now?: () => string;
  pageSize?: number;
}): Promise<BackfillReport> {
  const lookup = options.lookup ?? lookupUsAddress;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const interval = clampBackfillInterval(options.minIntervalMs ?? DEFAULT_BACKFILL_INTERVAL_MS);
  const pageSize = options.pageSize ?? 100;
  const retryFailed = options.retryFailed === true;
  const recordedAt = options.now ? options.now() : new Date().toISOString();
  const recordedMs = Date.parse(recordedAt);
  const nowMs = Number.isNaN(recordedMs) ? Date.now() : recordedMs;
  const report: BackfillReport = { examined: 0, lookedUp: 0, saved: 0, skipped: 0, failed: 0 };

  let offset = 0;
  for (;;) {
    const page = await options.store.list(options.tenantId, offset, pageSize);
    if (page.length === 0) break;
    for (const row of page) {
      if (row.tenant_id !== options.tenantId) {
        throw new Error('Backfill page included a row outside the tenant.');
      }
      report.examined += 1;
      if (!propertyNeedsGeocodeBackfill(row, retryFailed, nowMs)) {
        report.skipped += 1;
        continue;
      }
      if (report.lookedUp > 0) await sleep(interval);
      report.lookedUp += 1;
      let result: GeocodeResult;
      try {
        result = await lookup(rowAddress(row));
      } catch {
        result = {
          point: null,
          reason: 'lookup_failed',
          status: 'pending',
          source: null,
          accuracy: null,
          reused: false,
        };
      }
      const patch = propertyGeocodePatchFromResult(result, recordedAt);
      const saved = await options.store.save(options.tenantId, row, patch);
      if (saved === 'saved') {
        report.saved += 1;
        if (patch.geocode_status === 'failed' || patch.geocode_reason === 'lookup_failed') {
          report.failed += 1;
        }
      } else {
        report.skipped += 1;
      }
    }
    offset += page.length;
    if (page.length < pageSize) break;
  }

  return report;
}
