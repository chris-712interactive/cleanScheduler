import type { SupabaseClient } from '@supabase/supabase-js';
import { lookupUsAddress, type GeocodeAddress } from '@/lib/geo/censusGeocode';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function geocodeColumnsForAddress(parts: GeocodeAddress): Promise<{
  latitude: number | null;
  longitude: number | null;
  geocode_reason: string | null;
}> {
  const geocoded = await lookupUsAddress(parts);
  return {
    latitude: geocoded.point?.lat ?? null,
    longitude: geocoded.point?.lng ?? null,
    geocode_reason: geocoded.reason,
  };
}

/**
 * Writes a map point onto a service location that has an address but no coordinates.
 * A location that already has a point is left alone. Scheduling uses that point to
 * keep a far-away cleaner off the job.
 */
export async function ensurePropertyGeocoded(
  admin: Admin,
  tenantId: string,
  propertyId: string,
): Promise<{ latitude: number | null; longitude: number | null }> {
  const { data, error } = await admin
    .from('tenant_customer_properties')
    .select('address_line1, city, state, postal_code, latitude, longitude')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    return { latitude: null, longitude: null };
  }
  if (data.latitude != null && data.longitude != null) {
    return { latitude: data.latitude, longitude: data.longitude };
  }

  const geocoded = await geocodeColumnsForAddress({
    line1: data.address_line1,
    city: data.city,
    state: data.state,
    postalCode: data.postal_code,
  });
  if (geocoded.latitude == null && geocoded.geocode_reason == null) {
    return { latitude: null, longitude: null };
  }

  const saved = await admin
    .from('tenant_customer_properties')
    .update({
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      geocode_reason: geocoded.geocode_reason,
    })
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);

  if (saved.error) {
    console.error('[ensurePropertyGeocoded] could not save map point:', saved.error.message);
    return { latitude: null, longitude: null };
  }

  return { latitude: geocoded.latitude, longitude: geocoded.longitude };
}
