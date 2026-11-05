export type MileageVehicle = 'personal' | 'company';

export type MileageDayStatus = 'draft' | 'confirmed' | 'approved';

export type MileagePlaceKind =
  'home' | 'visit' | 'event' | 'supply' | 'estimate' | 'office' | 'other';

export type MileageLegSource = 'saved' | 'suggested' | 'typed';

export type MileageSettings = {
  reimbursementEnabled: boolean;
  rateCentsPerMile: number | null;
  askOdometer: boolean;
  countCommuteToFirst: boolean;
  countReturnHome: boolean;
  countBetweenStops: boolean;
  countOfficeLegs: boolean;
};

export const DEFAULT_MILEAGE_SETTINGS: MileageSettings = {
  reimbursementEnabled: false,
  rateCentsPerMile: null,
  askOdometer: false,
  countCommuteToFirst: false,
  countReturnHome: false,
  countBetweenStops: true,
  countOfficeLegs: true,
};

export type MileageStop = {
  label: string;
  address: string;
  kind: MileagePlaceKind;
  visitId: string | null;
  lat: number | null;
  lng: number | null;
  checkInAway: boolean;
};

export type MileageLegDraft = {
  originLabel: string;
  originAddress: string;
  originKind: MileagePlaceKind;
  originLat: number | null;
  originLng: number | null;
  destLabel: string;
  destAddress: string;
  destKind: MileagePlaceKind;
  destLat: number | null;
  destLng: number | null;
  visitId: string | null;
  included: boolean;
  miles: number | null;
  source: MileageLegSource;
  checkInAway: boolean;
};

export function roundMiles(value: number): number {
  return Math.round(value * 10) / 10;
}

export function segmentKey(label: string, lat: number | null, lng: number | null): string {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `geo:${lat.toFixed(4)},${lng.toFixed(4)}`;
  }
  return `addr:${label.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function isHome(kind: MileagePlaceKind): boolean {
  return kind === 'home';
}

function involvesOffice(from: MileagePlaceKind, to: MileagePlaceKind): boolean {
  return from === 'office' || to === 'office';
}

/** Whether this drive stays on the counted log under the owner's rules. */
export function legIsIncluded(
  from: MileagePlaceKind,
  to: MileagePlaceKind,
  settings: MileageSettings,
): boolean {
  if (isHome(from) && !isHome(to)) return settings.countCommuteToFirst;
  if (!isHome(from) && isHome(to)) return settings.countReturnHome;
  if (involvesOffice(from, to)) return settings.countOfficeLegs;
  return settings.countBetweenStops;
}

export function pairStops(stops: MileageStop[], settings: MileageSettings): MileageLegDraft[] {
  const legs: MileageLegDraft[] = [];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const origin = stops[index];
    const dest = stops[index + 1];
    if (!origin || !dest) continue;
    if (origin.label.trim() === dest.label.trim() && origin.kind === dest.kind) continue;
    legs.push({
      originLabel: origin.label,
      originAddress: origin.address,
      originKind: origin.kind,
      originLat: origin.lat,
      originLng: origin.lng,
      destLabel: dest.label,
      destAddress: dest.address,
      destKind: dest.kind,
      destLat: dest.lat,
      destLng: dest.lng,
      visitId: dest.visitId,
      included: legIsIncluded(origin.kind, dest.kind, settings),
      miles: null,
      source: 'typed',
      checkInAway: dest.checkInAway,
    });
  }
  return legs;
}

export function stopsFromLegs(legs: MileageLegDraft[]): MileageStop[] {
  const first = legs[0];
  if (!first) return [];
  const stops: MileageStop[] = [
    {
      label: first.originLabel,
      address: first.originAddress,
      kind: first.originKind,
      visitId: null,
      lat: first.originLat,
      lng: first.originLng,
      checkInAway: false,
    },
  ];
  for (const leg of legs) {
    stops.push({
      label: leg.destLabel,
      address: leg.destAddress,
      kind: leg.destKind,
      visitId: leg.visitId,
      lat: leg.destLat,
      lng: leg.destLng,
      checkInAway: leg.checkInAway,
    });
  }
  return stops;
}

/** Insert a work stop ahead of the drive home when that drive is on the day. */
export function preserveMiles(
  previous: MileageLegDraft[],
  next: MileageLegDraft[],
): MileageLegDraft[] {
  const byPair = new Map(previous.map((leg) => [pairKey(leg), leg]));
  return next.map((leg) => {
    const old = byPair.get(pairKey(leg));
    if (!old || old.miles == null) return leg;
    return { ...leg, miles: old.miles, source: old.source, included: old.included };
  });
}

export function withAddedStop(
  legs: MileageLegDraft[],
  stop: MileageStop,
  anchor: MileageStop,
  settings: MileageSettings,
): MileageLegDraft[] {
  if (legs.length === 0) return pairStops([anchor, stop], settings);
  return insertStop(legs, stop, settings);
}

export function insertStop(
  legs: MileageLegDraft[],
  stop: MileageStop,
  settings: MileageSettings,
): MileageLegDraft[] {
  const stops = stopsFromLegs(legs);
  const last = stops[stops.length - 1];
  const insertAt = last?.kind === 'home' ? stops.length - 1 : stops.length;
  stops.splice(insertAt, 0, stop);
  return pairStops(stops, settings);
}

export function countedMiles(legs: MileageLegDraft[]): number {
  const total = legs.reduce((sum, leg) => {
    if (!leg.included || leg.miles == null) return sum;
    return sum + leg.miles;
  }, 0);
  return roundMiles(total);
}

/** Every numbered drive, including ones the pay rules leave off. */
export function listedMiles(legs: MileageLegDraft[]): number {
  const total = legs.reduce((sum, leg) => (leg.miles == null ? sum : sum + leg.miles), 0);
  return roundMiles(total);
}

export function reimbursementCents(params: {
  settings: MileageSettings;
  vehicle: MileageVehicle;
  counted: number;
}): number | null {
  if (!params.settings.reimbursementEnabled) return null;
  if (params.vehicle === 'company') return 0;
  const rate = params.settings.rateCentsPerMile;
  if (rate == null || rate < 0) return null;
  return Math.round(params.counted * rate);
}

export function odometerSummary(
  start: number | null,
  end: number | null,
  listed: number,
): { driven: number | null; gap: number | null } {
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return { driven: null, gap: null };
  }
  if (end < start) return { driven: null, gap: null };
  const driven = roundMiles(end - start);
  return { driven, gap: roundMiles(driven - listed) };
}

export function chooseLegMiles(input: {
  savedMiles: number | null;
  suggestedMiles: number | null;
  typedMiles: number | null;
  typedEdited: boolean;
}): { miles: number | null; source: MileageLegSource } {
  if (input.typedEdited && input.typedMiles != null && input.typedMiles >= 0) {
    return { miles: roundMiles(input.typedMiles), source: 'typed' };
  }
  if (input.savedMiles != null && input.savedMiles >= 0) {
    return { miles: roundMiles(input.savedMiles), source: 'saved' };
  }
  if (input.suggestedMiles != null && input.suggestedMiles >= 0) {
    return { miles: roundMiles(input.suggestedMiles), source: 'suggested' };
  }
  if (input.typedMiles != null && input.typedMiles >= 0) {
    return { miles: roundMiles(input.typedMiles), source: 'typed' };
  }
  return { miles: null, source: 'typed' };
}

export function pairKey(leg: MileageLegDraft): string {
  return `${segmentKey(leg.originAddress || leg.originLabel, leg.originLat, leg.originLng)}|${segmentKey(leg.destAddress || leg.destLabel, leg.destLat, leg.destLng)}`;
}

export function applySavedAndSuggested(
  legs: MileageLegDraft[],
  savedByPair: Map<string, number>,
  suggestedByPair: Map<string, number>,
): MileageLegDraft[] {
  return legs.map((leg) => {
    const key = pairKey(leg);
    const chosen = chooseLegMiles({
      savedMiles: savedByPair.get(key) ?? null,
      suggestedMiles: suggestedByPair.get(key) ?? null,
      typedMiles: leg.miles,
      typedEdited: false,
    });
    return { ...leg, miles: chosen.miles, source: chosen.source };
  });
}

export function addDateKey(dateKey: string, days: number): string {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Monday of the calendar week that contains `dateKey`. */
export function mondayOf(dateKey: string): string {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const instant = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw)));
  const weekday = instant.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addDateKey(dateKey, delta);
}

/** Miles from a Mapricot route. `distanceMeters` is the driving distance. */
export function milesFromRoutePayload(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const routes = (payload as { routes?: { distanceMeters?: number }[] }).routes;
  const meters = routes?.[0]?.distanceMeters;
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return null;
  return roundMiles(meters / 1609.344);
}

export function mileageCsv(
  rows: {
    date: string;
    person: string;
    vehicle: string;
    miles: string;
    amount: string | null;
    status: string;
  }[],
  includeAmount: boolean,
): string {
  const headers = includeAmount
    ? ['Date', 'Person', 'Vehicle', 'Miles', 'Amount', 'Status']
    : ['Date', 'Person', 'Vehicle', 'Miles', 'Status'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const cells = includeAmount
      ? [row.date, row.person, row.vehicle, row.miles, row.amount ?? '', row.status]
      : [row.date, row.person, row.vehicle, row.miles, row.status];
    lines.push(cells.map(csvCell).join(','));
  }
  return lines.join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function parseRateDollars(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 10) return null;
  return Math.round(value * 100);
}

export function formatRateDollars(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}
