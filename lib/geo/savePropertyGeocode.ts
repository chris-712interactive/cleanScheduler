import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addressHasText,
  resolveGeocodedPoint,
  type GeocodeAddress,
  type StoredGeocode,
} from './censusGeocode';
import { propertyGeocodePatchFromResult, type PropertyGeocodePatch } from './propertyGeocodePatch';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

function addressFilter<
  Q extends { eq: (column: string, value: string) => Q; is: (column: string, value: null) => Q },
>(query: Q, address: GeocodeAddress): Q {
  const fields = [
    ['address_line1', address.line1],
    ['city', address.city],
    ['state', address.state],
    ['postal_code', address.postalCode],
  ] as const;
  return fields.reduce((current, [column, value]) => {
    const trimmed = value?.trim() || null;
    return trimmed == null ? current.is(column, null) : current.eq(column, trimmed);
  }, query);
}

/**
 * Looks up a service location and stores the result.
 * Returns null when the address is unchanged and the stored attempt is kept.
 * Never throws. A failed lookup or a failed write leaves the address row in place.
 */
export async function savePropertyGeocode(
  admin: Admin,
  input: {
    tenantId: string;
    propertyId: string;
    address: GeocodeAddress;
    previous?: StoredGeocode | null;
    now?: () => string;
  },
): Promise<PropertyGeocodePatch | null> {
  if (!addressHasText(input.address)) return null;

  const recordedAt = input.now ? input.now() : new Date().toISOString();
  let patch: PropertyGeocodePatch;
  try {
    const nowMs = Date.parse(recordedAt);
    const result = await resolveGeocodedPoint(
      input.address,
      input.previous ?? null,
      undefined,
      Number.isNaN(nowMs) ? Date.now() : nowMs,
    );
    if (result.reused) return null;
    patch = propertyGeocodePatchFromResult(result, recordedAt);
  } catch (error) {
    console.error('[geocode] lookup failed:', error instanceof Error ? error.message : 'unknown');
    return null;
  }

  try {
    const saved = await addressFilter(
      admin
        .from('tenant_customer_properties')
        .update(patch)
        .eq('id', input.propertyId)
        .eq('tenant_id', input.tenantId)
        .select('id'),
      input.address,
    );
    if (saved.error || !saved.data || saved.data.length === 0) {
      console.error(
        '[geocode] could not store map point:',
        saved.error?.message ?? 'the row was not updated',
      );
      return null;
    }
  } catch (error) {
    console.error(
      '[geocode] could not store map point:',
      error instanceof Error ? error.message : 'unknown',
    );
    return null;
  }
  return patch;
}
