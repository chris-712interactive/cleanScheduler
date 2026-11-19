import type { SupabaseClient } from '@supabase/supabase-js';
import { lookupUsAddress, type GeocodeAddress } from './censusGeocode';
import { propertyGeocodePatchFromResult, type PropertyGeocodePatch } from './propertyGeocodePatch';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function geocodeColumnsForAddress(
  parts: GeocodeAddress,
): Promise<PropertyGeocodePatch> {
  const geocoded = await lookupUsAddress(parts);
  return propertyGeocodePatchFromResult(geocoded, new Date().toISOString());
}

/**
 * Writes a map point onto a service location that has an address but no coordinates
 * and has not already finished a lookup. A location that already has a point, or a
 * stored failure, is left alone.
 */
export async function ensurePropertyGeocoded(
  admin: Admin,
  tenantId: string,
  propertyId: string,
): Promise<{ latitude: number | null; longitude: number | null }> {
  const { data, error } = await admin
    .from('tenant_customer_properties')
    .select('address_line1, city, state, postal_code, latitude, longitude, geocode_status')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    return { latitude: null, longitude: null };
  }
  if (data.latitude != null && data.longitude != null) {
    return { latitude: data.latitude, longitude: data.longitude };
  }
  if (data.geocode_status === 'failed' || data.geocode_status === 'ok') {
    return { latitude: data.latitude, longitude: data.longitude };
  }

  let patch: PropertyGeocodePatch;
  try {
    patch = await geocodeColumnsForAddress({
      line1: data.address_line1,
      city: data.city,
      state: data.state,
      postalCode: data.postal_code,
    });
  } catch (lookupError) {
    console.error(
      '[ensurePropertyGeocoded] lookup failed:',
      lookupError instanceof Error ? lookupError.message : 'unknown',
    );
    return { latitude: null, longitude: null };
  }
  if (patch.latitude == null && patch.geocode_reason == null && patch.geocode_status == null) {
    return { latitude: null, longitude: null };
  }

  let update = admin
    .from('tenant_customer_properties')
    .update(patch)
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);
  const fields = [
    ['address_line1', data.address_line1],
    ['city', data.city],
    ['state', data.state],
    ['postal_code', data.postal_code],
  ] as const;
  for (const [column, value] of fields) {
    const trimmed = value?.trim() || null;
    update = trimmed == null ? update.is(column, null) : update.eq(column, trimmed);
  }
  const saved = await update;

  if (saved.error) {
    console.error('[ensurePropertyGeocoded] could not save map point:', saved.error.message);
    return { latitude: null, longitude: null };
  }

  return { latitude: patch.latitude, longitude: patch.longitude };
}
