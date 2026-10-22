import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  approximateTravelMinutes,
  isTooFarFromLocation,
  type PlaceHint,
} from '@/lib/schedule/optimizer/geo';

type Admin = SupabaseClient<Database>;

const TRAVEL_SPEED_MPH = 25;

/**
 * People whose home is a multi-hour drive from the visit's service location.
 * Calendar availability does not include this, so the assign list has to.
 */
export async function tooFarUserIdsForVisit(
  admin: Admin,
  tenantId: string,
  visitId: string,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const { data: visit } = await admin
    .from('tenant_scheduled_visits')
    .select('property_id')
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!visit?.property_id) return new Set();

  const { data: property } = await admin
    .from('tenant_customer_properties')
    .select('latitude, longitude, city, state, postal_code')
    .eq('id', visit.property_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!property) return new Set();

  const destination: PlaceHint = {
    point:
      property.latitude != null && property.longitude != null
        ? { lat: property.latitude, lng: property.longitude }
        : null,
    city: property.city,
    state: property.state,
    postalCode: property.postal_code,
  };

  const { data: homes } = await admin
    .from('tenant_member_scheduling_profiles')
    .select('user_id, home_latitude, home_longitude, home_city, home_state, home_postal_code')
    .eq('tenant_id', tenantId)
    .in('user_id', userIds);

  const far = new Set<string>();
  for (const home of homes ?? []) {
    const minutes = approximateTravelMinutes(
      {
        point:
          home.home_latitude != null && home.home_longitude != null
            ? { lat: home.home_latitude, lng: home.home_longitude }
            : null,
        city: home.home_city,
        state: home.home_state,
        postalCode: home.home_postal_code,
      },
      destination,
      TRAVEL_SPEED_MPH,
    );
    if (isTooFarFromLocation(minutes)) far.add(home.user_id);
  }
  return far;
}
