import type { Json } from '@/lib/supabase/database.types';
import type { MinuteInterval } from '@/lib/schedule/optimizer/types';

export type SchedulingFacts = {
  preferredUserIds: string[];
  requiredUserIds: string[];
  blockedUserIds: string[];
  arrivalWindow: MinuteInterval | null;
  accessWindow: MinuteInterval | null;
  petInHome: boolean;
  chemicalSensitivity: boolean;
  languageCodes: string[];
  requiredAttributeTags: string[];
  priority: number;
  requiredCrewSize: number;
  requiredSkillTags: string[];
  requiredCertificationTags: string[];
  requiredEquipmentTags: string[];
  requiresKeyPickup: boolean;
};

export type SchedulingFactsRow = {
  preferred_user_ids: string[];
  required_user_ids: string[];
  blocked_user_ids: string[];
  arrival_start: string | null;
  arrival_end: string | null;
  access_start: string | null;
  access_end: string | null;
  pet_in_home: boolean;
  chemical_sensitivity: boolean;
  language_codes: string[];
  required_attribute_tags: string[];
  priority: number;
  required_crew_size: number;
  required_skill_tags: string[];
  required_certification_tags: string[];
  required_equipment_tags: string[];
  requires_key_pickup: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function emptySchedulingFacts(): SchedulingFacts {
  return {
    preferredUserIds: [],
    requiredUserIds: [],
    blockedUserIds: [],
    arrivalWindow: null,
    accessWindow: null,
    petInHome: false,
    chemicalSensitivity: false,
    languageCodes: [],
    requiredAttributeTags: [],
    priority: 3,
    requiredCrewSize: 1,
    requiredSkillTags: [],
    requiredCertificationTags: [],
    requiredEquipmentTags: [],
    requiresKeyPickup: false,
  };
}

export function parseTagList(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const tag = part.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags.slice(0, 20);
}

export function formatTagList(tags: string[]): string {
  return tags.join(', ');
}

function timeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function windowFromTimes(start: string | null, end: string | null): MinuteInterval | null {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin == null || endMin == null || endMin <= startMin) return null;
  return { startMin, endMin };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && UUID_RE.test(item));
}

function asTagArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function schedulingFactsFromRow(row: SchedulingFactsRow | null): SchedulingFacts {
  if (!row) return emptySchedulingFacts();
  return {
    preferredUserIds: row.preferred_user_ids ?? [],
    requiredUserIds: row.required_user_ids ?? [],
    blockedUserIds: row.blocked_user_ids ?? [],
    arrivalWindow: windowFromTimes(row.arrival_start, row.arrival_end),
    accessWindow: windowFromTimes(row.access_start, row.access_end),
    petInHome: row.pet_in_home,
    chemicalSensitivity: row.chemical_sensitivity,
    languageCodes: row.language_codes ?? [],
    requiredAttributeTags: row.required_attribute_tags ?? [],
    priority: row.priority,
    requiredCrewSize: row.required_crew_size,
    requiredSkillTags: row.required_skill_tags ?? [],
    requiredCertificationTags: row.required_certification_tags ?? [],
    requiredEquipmentTags: row.required_equipment_tags ?? [],
    requiresKeyPickup: row.requires_key_pickup,
  };
}

/** A property override replaces the customer default. Null keeps the default. */
export function effectiveSchedulingFacts(
  customer: SchedulingFacts,
  override: unknown,
): SchedulingFacts {
  if (!isRecord(override)) return customer;
  return {
    preferredUserIds: asStringArray(override.preferredUserIds ?? customer.preferredUserIds),
    requiredUserIds: asStringArray(override.requiredUserIds ?? customer.requiredUserIds),
    blockedUserIds: asStringArray(override.blockedUserIds ?? customer.blockedUserIds),
    arrivalWindow:
      windowFromTimes(
        typeof override.arrivalStart === 'string' ? override.arrivalStart : null,
        typeof override.arrivalEnd === 'string' ? override.arrivalEnd : null,
      ) ?? (override.arrivalStart === null ? null : customer.arrivalWindow),
    accessWindow:
      windowFromTimes(
        typeof override.accessStart === 'string' ? override.accessStart : null,
        typeof override.accessEnd === 'string' ? override.accessEnd : null,
      ) ?? (override.accessStart === null ? null : customer.accessWindow),
    petInHome: typeof override.petInHome === 'boolean' ? override.petInHome : customer.petInHome,
    chemicalSensitivity:
      typeof override.chemicalSensitivity === 'boolean'
        ? override.chemicalSensitivity
        : customer.chemicalSensitivity,
    languageCodes: asTagArray(override.languageCodes ?? customer.languageCodes),
    requiredAttributeTags: asTagArray(
      override.requiredAttributeTags ?? customer.requiredAttributeTags,
    ),
    priority:
      typeof override.priority === 'number'
        ? Math.min(5, Math.max(1, Math.round(override.priority)))
        : customer.priority,
    requiredCrewSize:
      typeof override.requiredCrewSize === 'number'
        ? Math.min(8, Math.max(1, Math.round(override.requiredCrewSize)))
        : customer.requiredCrewSize,
    requiredSkillTags: asTagArray(override.requiredSkillTags ?? customer.requiredSkillTags),
    requiredCertificationTags: asTagArray(
      override.requiredCertificationTags ?? customer.requiredCertificationTags,
    ),
    requiredEquipmentTags: asTagArray(
      override.requiredEquipmentTags ?? customer.requiredEquipmentTags,
    ),
    requiresKeyPickup:
      typeof override.requiresKeyPickup === 'boolean'
        ? override.requiresKeyPickup
        : customer.requiresKeyPickup,
  };
}

function checkedIds(formData: FormData, name: string, allowed: Set<string>): string[] {
  return [
    ...new Set(
      formData
        .getAll(name)
        .map((value) => String(value).trim())
        .filter((id) => allowed.has(id)),
    ),
  ];
}

function optionalTime(formData: FormData, name: string): string | null {
  const raw = String(formData.get(name) ?? '').trim();
  const minutes = timeToMinutes(raw);
  return minutes == null ? null : minutesToTime(minutes);
}

export function schedulingFactsFromForm(
  formData: FormData,
  allowedUserIds: string[],
): SchedulingFacts {
  const allowed = new Set(allowedUserIds);
  const arrivalStart = optionalTime(formData, 'arrival_start');
  const arrivalEnd = optionalTime(formData, 'arrival_end');
  const accessStart = optionalTime(formData, 'access_start');
  const accessEnd = optionalTime(formData, 'access_end');
  const priority = Number(formData.get('priority'));
  const crewSize = Number(formData.get('required_crew_size'));
  return {
    preferredUserIds: checkedIds(formData, 'preferred_user_id', allowed),
    requiredUserIds: checkedIds(formData, 'required_user_id', allowed),
    blockedUserIds: checkedIds(formData, 'blocked_user_id', allowed),
    arrivalWindow: windowFromTimes(arrivalStart, arrivalEnd),
    accessWindow: windowFromTimes(accessStart, accessEnd),
    petInHome: formData.get('pet_in_home') === 'on',
    chemicalSensitivity: formData.get('chemical_sensitivity') === 'on',
    languageCodes: parseTagList(String(formData.get('language_codes') ?? '')),
    requiredAttributeTags: parseTagList(String(formData.get('required_attribute_tags') ?? '')),
    priority: Number.isFinite(priority) ? Math.min(5, Math.max(1, Math.round(priority))) : 3,
    requiredCrewSize: Number.isFinite(crewSize)
      ? Math.min(8, Math.max(1, Math.round(crewSize)))
      : 1,
    requiredSkillTags: parseTagList(String(formData.get('required_skill_tags') ?? '')),
    requiredCertificationTags: parseTagList(
      String(formData.get('required_certification_tags') ?? ''),
    ),
    requiredEquipmentTags: parseTagList(String(formData.get('required_equipment_tags') ?? '')),
    requiresKeyPickup: formData.get('requires_key_pickup') === 'on',
  };
}

export function schedulingFactsToRow(facts: SchedulingFacts): Omit<SchedulingFactsRow, never> {
  return {
    preferred_user_ids: facts.preferredUserIds,
    required_user_ids: facts.requiredUserIds,
    blocked_user_ids: facts.blockedUserIds,
    arrival_start: facts.arrivalWindow ? minutesToTime(facts.arrivalWindow.startMin) : null,
    arrival_end: facts.arrivalWindow ? minutesToTime(facts.arrivalWindow.endMin) : null,
    access_start: facts.accessWindow ? minutesToTime(facts.accessWindow.startMin) : null,
    access_end: facts.accessWindow ? minutesToTime(facts.accessWindow.endMin) : null,
    pet_in_home: facts.petInHome,
    chemical_sensitivity: facts.chemicalSensitivity,
    language_codes: facts.languageCodes,
    required_attribute_tags: facts.requiredAttributeTags,
    priority: facts.priority,
    required_crew_size: facts.requiredCrewSize,
    required_skill_tags: facts.requiredSkillTags,
    required_certification_tags: facts.requiredCertificationTags,
    required_equipment_tags: facts.requiredEquipmentTags,
    requires_key_pickup: facts.requiresKeyPickup,
  };
}

export function schedulingFactsToOverride(facts: SchedulingFacts): Json {
  return {
    preferredUserIds: facts.preferredUserIds,
    requiredUserIds: facts.requiredUserIds,
    blockedUserIds: facts.blockedUserIds,
    arrivalStart: facts.arrivalWindow ? minutesToTime(facts.arrivalWindow.startMin) : null,
    arrivalEnd: facts.arrivalWindow ? minutesToTime(facts.arrivalWindow.endMin) : null,
    accessStart: facts.accessWindow ? minutesToTime(facts.accessWindow.startMin) : null,
    accessEnd: facts.accessWindow ? minutesToTime(facts.accessWindow.endMin) : null,
    petInHome: facts.petInHome,
    chemicalSensitivity: facts.chemicalSensitivity,
    languageCodes: facts.languageCodes,
    requiredAttributeTags: facts.requiredAttributeTags,
    priority: facts.priority,
    requiredCrewSize: facts.requiredCrewSize,
    requiredSkillTags: facts.requiredSkillTags,
    requiredCertificationTags: facts.requiredCertificationTags,
    requiredEquipmentTags: facts.requiredEquipmentTags,
    requiresKeyPickup: facts.requiresKeyPickup,
  };
}

export function timeInputValue(window: MinuteInterval | null, edge: 'start' | 'end'): string {
  if (!window) return '';
  return minutesToTime(edge === 'start' ? window.startMin : window.endMin);
}
