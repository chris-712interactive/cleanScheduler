import { formatVisitTime } from '@/lib/datetime/formatInTimeZone';
import { visitTouchesCalendarDayInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import { isCalendarDateKey } from '@/lib/tenant/scheduleDateRange';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';

/**
 * OpenFreeMap Liberty. OpenStreetMap data via the OpenMapTiles schema.
 * Public instance: no API key, commercial use allowed, no stated view cap, no SLA.
 * Production should set NEXT_PUBLIC_MAP_STYLE_URL to a self-hosted Protomaps style.
 */
export const DAY_MAP_DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const BLOCKED_STYLE_HOSTS = ['mapbox.com', 'mapbox.cn', 'googleapis.com', 'google.com'];

const CLEANER_COLORS = [
  '#2563eb',
  '#db2777',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#dc2626',
  '#4f46e5',
  '#65a30d',
  '#0f766e',
] as const;

export const DAY_MAP_UNASSIGNED_COLOR = '#64748b';
const UNASSIGNED_GROUP_ID = 'unassigned';

/** Degrees (~13 m) so two visits at the same door can both be clicked. */
const DUPLICATE_PIN_OFFSET_DEG = 0.00012;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DayMapPropertyRow = {
  tenant_id?: string | null;
  is_primary?: boolean | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  geocode_reason: string | null;
};

export type DayMapAssigneeRow = {
  user_id: string;
  user_profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

export type DayMapVisitRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'cancelled' | string;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
    tenant_customer_properties: DayMapPropertyRow | DayMapPropertyRow[] | null;
  } | null;
  tenant_customer_properties: DayMapPropertyRow | DayMapPropertyRow[] | null;
  tenant_scheduled_visit_assignees: DayMapAssigneeRow | DayMapAssigneeRow[] | null;
};

export type DayMapPin = {
  visitId: string;
  customerName: string;
  siteLine: string;
  timeLabel: string;
  assigneeLabel: string;
  href: string;
  latitude: number;
  longitude: number;
  pinLatitude: number;
  pinLongitude: number;
  groupId: string;
  color: string;
  status: 'scheduled' | 'completed';
};

export type DayMapGroup = {
  id: string;
  label: string;
  color: string;
  visitCount: number;
};

export type DayMapMissingVisit = {
  visitId: string;
  customerName: string;
  siteLine: string;
  timeLabel: string;
  reasonLabel: string;
  href: string;
  customerHref: string | null;
};

export type DayMapModel = {
  pins: DayMapPin[];
  groups: DayMapGroup[];
  missing: DayMapMissingVisit[];
};

export function resolveDayMapStyleUrl(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return DAY_MAP_DEFAULT_STYLE_URL;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return DAY_MAP_DEFAULT_STYLE_URL;
  }
  if (url.protocol !== 'https:') return DAY_MAP_DEFAULT_STYLE_URL;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const blocked = BLOCKED_STYLE_HOSTS.some(
    (blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`),
  );
  if (blocked) return DAY_MAP_DEFAULT_STYLE_URL;
  return url.toString();
}

export function dayMapStyleNotice(styleUrl: string): string {
  if (styleUrl === DAY_MAP_DEFAULT_STYLE_URL) {
    return 'Map data © OpenStreetMap contributors. Tiles from OpenFreeMap (OpenMapTiles). The public tiles are free for this use and have no uptime guarantee.';
  }
  return 'Map tiles follow NEXT_PUBLIC_MAP_STYLE_URL.';
}

export const DAY_MAP_STYLE_FAILURE =
  'The map could not start. The lists beside it still show this day.';

/** Shown when the style has not loaded. Tile errors after a loaded style stay quiet. */
export function dayMapStyleFailureNote(styleLoaded: boolean): string | null {
  return styleLoaded ? null : DAY_MAP_STYLE_FAILURE;
}

export function formatDayMapDateLabel(dateKey: string): string {
  if (!isCalendarDateKey(dateKey)) return dateKey;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(noonUtc);
}

/** Short reason shown beside the map when a visit has no usable point. */
export function dayMapMissingReasonLabel(input: {
  hasProperty: boolean;
  geocodeReason: string | null | undefined;
}): string {
  if (!input.hasProperty) return 'No service location';
  switch (input.geocodeReason) {
    case 'no_match':
      return "Couldn't locate this address";
    case 'lookup_failed':
      return 'Lookup will retry';
    case 'outside_us':
      return 'Outside the United States';
    case 'incomplete':
      return 'Address is too short to look up';
    case 'google_denied':
      return 'Lookup was rejected';
    case 'google_quota':
      return 'Lookup will retry';
    default:
      return 'Missing map point';
  }
}

export function shapeDayMap(input: {
  tenantId: string;
  dateKey: string;
  timeZone: string;
  rows: DayMapVisitRow[];
}): DayMapModel {
  const tenantId = input.tenantId.trim();
  const ordered = [...input.rows].sort((a, b) => {
    const byTime = a.starts_at.localeCompare(b.starts_at);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });

  const pins: DayMapPin[] = [];
  const missing: DayMapMissingVisit[] = [];
  const groups = new Map<string, DayMapGroup>();
  let cleanerColorIndex = 0;

  for (const row of ordered) {
    if (row.tenant_id !== tenantId) continue;
    if (row.status === 'cancelled') continue;
    if (
      !visitTouchesCalendarDayInTimeZone(
        { starts_at: row.starts_at, ends_at: row.ends_at },
        input.dateKey,
        input.timeZone,
      )
    ) {
      continue;
    }

    const customerName = customerNameFromRow(row);
    const timeLabel = `${formatVisitTime(row.starts_at, input.timeZone)} – ${formatVisitTime(row.ends_at, input.timeZone)}`;
    const href = visitHref(row.id);
    const location = chooseLocation(row, tenantId);
    const siteLine = formatPropertyAddressLine(location.property);
    const point = readPoint(location.property);
    const people = orderedAssignees(row.tenant_scheduled_visit_assignees);
    const assigneeLabel =
      people.length > 0 ? people.map((person) => person.displayName).join(', ') : 'Unassigned';

    if (!point || (row.status !== 'scheduled' && row.status !== 'completed')) {
      if (row.status !== 'scheduled' && row.status !== 'completed') continue;
      missing.push({
        visitId: row.id,
        customerName,
        siteLine,
        timeLabel,
        reasonLabel: dayMapMissingReasonLabel({
          hasProperty: location.hasProperty,
          geocodeReason: location.property?.geocode_reason,
        }),
        href,
        customerHref: customerHref(row.customer_id),
      });
      continue;
    }

    const primary = people[0];
    const groupId = primary ? `cleaner:${primary.userId}` : UNASSIGNED_GROUP_ID;
    const groupLabel = primary ? primary.displayName : 'Unassigned';
    const color = colorForGroup(groups, groupId, groupLabel, () => {
      const next = CLEANER_COLORS[cleanerColorIndex % CLEANER_COLORS.length] ?? CLEANER_COLORS[0];
      cleanerColorIndex += 1;
      return next;
    });

    pins.push({
      visitId: row.id,
      customerName,
      siteLine,
      timeLabel,
      assigneeLabel,
      href,
      latitude: point.latitude,
      longitude: point.longitude,
      pinLatitude: point.latitude,
      pinLongitude: point.longitude,
      groupId,
      color,
      status: row.status,
    });
  }

  spreadDuplicatePins(pins);

  const groupList = [...groups.values()];
  return {
    pins,
    groups: [
      ...groupList.filter((group) => group.id !== UNASSIGNED_GROUP_ID),
      ...groupList.filter((group) => group.id === UNASSIGNED_GROUP_ID),
    ],
    missing,
  };
}

function colorForGroup(
  groups: Map<string, DayMapGroup>,
  groupId: string,
  label: string,
  nextCleanerColor: () => string,
): string {
  const existing = groups.get(groupId);
  if (existing) {
    existing.visitCount += 1;
    return existing.color;
  }
  const color = groupId === UNASSIGNED_GROUP_ID ? DAY_MAP_UNASSIGNED_COLOR : nextCleanerColor();
  groups.set(groupId, { id: groupId, label, color, visitCount: 1 });
  return color;
}

function spreadDuplicatePins(pins: DayMapPin[]): void {
  const buckets = new Map<string, DayMapPin[]>();
  for (const pin of pins) {
    const key = `${pin.latitude.toFixed(5)}|${pin.longitude.toFixed(5)}`;
    const list = buckets.get(key) ?? [];
    list.push(pin);
    buckets.set(key, list);
  }
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    list.forEach((pin, index) => {
      const angle = (2 * Math.PI * index) / list.length;
      pin.pinLatitude = pin.latitude + Math.sin(angle) * DUPLICATE_PIN_OFFSET_DEG;
      pin.pinLongitude = pin.longitude + Math.cos(angle) * DUPLICATE_PIN_OFFSET_DEG;
    });
  }
}

function customerNameFromRow(row: DayMapVisitRow): string {
  const identity = row.customers?.customer_identities;
  if (identity && customerHasAnyNameParts(identity)) return formatCustomerDisplayName(identity);
  return 'Customer';
}

function chooseLocation(
  row: DayMapVisitRow,
  tenantId: string,
): { property: DayMapPropertyRow | null; hasProperty: boolean } {
  if (row.property_id) {
    const linked = propertiesForTenant(row.tenant_customer_properties, tenantId);
    return { property: linked[0] ?? null, hasProperty: true };
  }
  const fallback = propertiesForTenant(row.customers?.tenant_customer_properties, tenantId);
  if (fallback.length === 0) return { property: null, hasProperty: false };
  const primary = fallback.find((property) => property.is_primary) ?? fallback[0];
  return { property: primary ?? null, hasProperty: true };
}

function propertiesForTenant(
  value: DayMapPropertyRow | DayMapPropertyRow[] | null | undefined,
  tenantId: string,
): DayMapPropertyRow[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.filter((property) => !property.tenant_id || property.tenant_id === tenantId);
}

function readPoint(
  property: DayMapPropertyRow | null,
): { latitude: number; longitude: number } | null {
  if (!property || property.latitude == null || property.longitude == null) return null;
  const latitude =
    typeof property.latitude === 'number' ? property.latitude : Number(property.latitude);
  const longitude =
    typeof property.longitude === 'number' ? property.longitude : Number(property.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function orderedAssignees(
  raw: DayMapAssigneeRow | DayMapAssigneeRow[] | null | undefined,
): { userId: string; displayName: string }[] {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const seen = new Set<string>();
  const people: { userId: string; displayName: string }[] = [];
  for (const row of rows) {
    const userId = row.user_id?.trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    const profile = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
    people.push({
      userId,
      displayName: profile?.display_name?.trim() || 'Cleaner',
    });
  }
  people.sort((a, b) => {
    const byName = a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return a.userId.localeCompare(b.userId);
  });
  return people;
}

function visitHref(id: string): string {
  return UUID_RE.test(id) ? `/schedule/${id}` : '/schedule';
}

function customerHref(id: string): string | null {
  return UUID_RE.test(id) ? `/customers/${id}` : null;
}
