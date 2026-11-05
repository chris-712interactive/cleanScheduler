import {
  roundMiles,
  type MileageLegDraft,
  type MileageLegSource,
  type MileagePlaceKind,
  type MileageVehicle,
} from '@/lib/mileage/model';

const KINDS = new Set<MileagePlaceKind>([
  'home',
  'visit',
  'event',
  'supply',
  'estimate',
  'office',
  'other',
]);

const SOURCES = new Set<MileageLegSource>(['saved', 'suggested', 'typed']);

function kindOf(raw: string): MileagePlaceKind {
  return KINDS.has(raw as MileagePlaceKind) ? (raw as MileagePlaceKind) : 'other';
}

function sourceOf(raw: string): MileageLegSource {
  return SOURCES.has(raw as MileageLegSource) ? (raw as MileageLegSource) : 'typed';
}

function coord(raw: FormDataEntryValue | null): number | null {
  const value = Number(String(raw ?? '').trim());
  return Number.isFinite(value) ? value : null;
}

function milesOf(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 2000) return null;
  return roundMiles(value);
}

export function parseLegsFromForm(formData: FormData): MileageLegDraft[] {
  const count = Number(formData.get('leg_count') ?? 0);
  if (!Number.isFinite(count) || count < 0 || count > 40) return [];
  const legs: MileageLegDraft[] = [];
  for (let index = 0; index < count; index += 1) {
    const prefix = `leg_${index}_`;
    const milesRaw = String(formData.get(`${prefix}miles`) ?? '').trim();
    const original = String(formData.get(`${prefix}original_miles`) ?? '').trim();
    const typedEdited = milesRaw !== original;
    const miles = milesOf(milesRaw);
    legs.push({
      originLabel: String(formData.get(`${prefix}origin_label`) ?? '').trim() || 'Stop',
      originAddress: String(formData.get(`${prefix}origin_address`) ?? '').trim(),
      originKind: kindOf(String(formData.get(`${prefix}origin_kind`) ?? '')),
      originLat: coord(formData.get(`${prefix}origin_lat`)),
      originLng: coord(formData.get(`${prefix}origin_lng`)),
      destLabel: String(formData.get(`${prefix}dest_label`) ?? '').trim() || 'Stop',
      destAddress: String(formData.get(`${prefix}dest_address`) ?? '').trim(),
      destKind: kindOf(String(formData.get(`${prefix}dest_kind`) ?? '')),
      destLat: coord(formData.get(`${prefix}dest_lat`)),
      destLng: coord(formData.get(`${prefix}dest_lng`)),
      visitId: String(formData.get(`${prefix}visit_id`) ?? '').trim() || null,
      included: formData.get(`${prefix}included`) === 'on',
      miles,
      source: typedEdited ? 'typed' : sourceOf(String(formData.get(`${prefix}source`) ?? '')),
      checkInAway: formData.get(`${prefix}check_in_away`) === '1',
    });
  }
  return legs;
}

export function parseVehicle(raw: FormDataEntryValue | null): MileageVehicle {
  return raw === 'company' ? 'company' : 'personal';
}

export function parseOdometer(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const value = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 0 || value > 9_999_999) return null;
  return roundMiles(value);
}
