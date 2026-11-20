import type { SupabaseClient } from '@supabase/supabase-js';
import type { LatLng } from '@/lib/schedule/optimizer/types';
import { pointsMatch, usablePoint } from '@/lib/routing/engineOptimizer';
import type { Database } from '@/lib/supabase/database.types';

export type RouteStartKind = 'office' | 'home' | 'location';
export type RouteEndKind = 'none' | 'same' | 'office' | 'home' | 'location';

export type StoredRouteBase = {
  userId: string;
  serviceDate: string | null;
  startKind: RouteStartKind;
  startLocationId: string | null;
  endKind: RouteEndKind;
  endLocationId: string | null;
};

export type RouteLocationPoint = {
  id: string;
  label: string;
  point: LatLng | null;
};

export type ResolvedRouteBase = {
  start: LatLng | null;
  end: LatLng | null;
  startLabel: string;
  endLabel: string | null;
};

const STARTS = new Set<RouteStartKind>(['office', 'home', 'location']);
const ENDS = new Set<RouteEndKind>(['none', 'same', 'office', 'home', 'location']);

export function parseRouteStartKind(value: string): RouteStartKind | null {
  return STARTS.has(value as RouteStartKind) ? (value as RouteStartKind) : null;
}

export function parseRouteEndKind(value: string): RouteEndKind | null {
  return ENDS.has(value as RouteEndKind) ? (value as RouteEndKind) : null;
}

function locationPoint(
  id: string | null,
  locations: readonly RouteLocationPoint[],
): { point: LatLng | null; label: string } | null {
  if (!id) return null;
  const row = locations.find((location) => location.id === id);
  if (!row) return null;
  return { point: usablePoint(row.point), label: row.label };
}

/**
 * Picks the day's override, then the cleaner's default.
 * A null start means the office (or the first stop when the office has no point).
 */
export function resolveCleanerBase(input: {
  userId: string;
  serviceDate: string;
  bases: readonly StoredRouteBase[];
  office: LatLng | null;
  home: LatLng | null;
  locations: readonly RouteLocationPoint[];
}): ResolvedRouteBase {
  const rows = input.bases.filter((row) => row.userId === input.userId);
  const chosen =
    rows.find((row) => row.serviceDate === input.serviceDate) ??
    rows.find((row) => row.serviceDate == null) ??
    null;
  const office = usablePoint(input.office);
  const home = usablePoint(input.home);
  const startKind = chosen?.startKind ?? 'office';
  const endKind = chosen?.endKind ?? 'none';

  let start: LatLng | null = null;
  let startLabel = 'Office';
  if (startKind === 'home' && home) {
    start = home;
    startLabel = 'Home';
  } else if (startKind === 'location') {
    const place = locationPoint(chosen?.startLocationId ?? null, input.locations);
    if (place?.point) {
      start = place.point;
      startLabel = place.label;
    }
  }

  let end: LatLng | null = null;
  let endLabel: string | null = null;
  if (endKind === 'same') {
    end = start ?? office;
    endLabel = start ? startLabel : office ? 'Office' : null;
  } else if (endKind === 'office' && office) {
    end = office;
    endLabel = 'Office';
  } else if (endKind === 'home' && home) {
    end = home;
    endLabel = 'Home';
  } else if (endKind === 'location') {
    const place = locationPoint(chosen?.endLocationId ?? null, input.locations);
    if (place?.point) {
      end = place.point;
      endLabel = place.label;
    }
  }
  if (end && start && pointsMatch(end, start) && endKind === 'none') {
    end = null;
    endLabel = null;
  }

  return {
    start,
    end,
    startLabel: start ? startLabel : office ? 'Office' : 'First stop',
    endLabel,
  };
}

type QueryError = { code?: string | null; message?: string | null };

export function isMissingRelationError(error: QueryError | null | undefined): boolean {
  if (!error) return false;
  const text = (error.message ?? '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    text.includes('does not exist') ||
    text.includes('schema cache')
  );
}

type BaseRow = {
  user_id: string;
  service_date: string | null;
  start_kind: string;
  start_location_id: string | null;
  end_kind: string;
  end_location_id: string | null;
};

export async function loadRouteBaseRows(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<{ bases: StoredRouteBase[]; locations: RouteLocationPoint[] } | null> {
  const [baseResult, locationResult] = await Promise.all([
    supabase
      .from('tenant_cleaner_route_bases')
      .select('user_id, service_date, start_kind, start_location_id, end_kind, end_location_id')
      .eq('tenant_id', tenantId),
    supabase
      .from('tenant_route_locations')
      .select('id, label, latitude, longitude')
      .eq('tenant_id', tenantId),
  ]);
  if (isMissingRelationError(baseResult.error) || isMissingRelationError(locationResult.error)) {
    return null;
  }
  if (baseResult.error) throw new Error(baseResult.error.message);
  if (locationResult.error) throw new Error(locationResult.error.message);
  const bases: StoredRouteBase[] = ((baseResult.data ?? []) as BaseRow[]).flatMap((row) => {
    const startKind = parseRouteStartKind(row.start_kind);
    const endKind = parseRouteEndKind(row.end_kind);
    if (!startKind || !endKind) return [];
    return [
      {
        userId: row.user_id,
        serviceDate: row.service_date,
        startKind,
        startLocationId: row.start_location_id,
        endKind,
        endLocationId: row.end_location_id,
      },
    ];
  });
  const locations: RouteLocationPoint[] = (locationResult.data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    point:
      row.latitude != null && row.longitude != null
        ? usablePoint({ lat: row.latitude, lng: row.longitude })
        : null,
  }));
  return { bases, locations };
}
