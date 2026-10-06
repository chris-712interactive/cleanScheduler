import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';

export const CONSULTATION_SERVICES = [
  { value: 'recurring', label: 'Recurring maintenance' },
  { value: 'deep', label: 'Deep clean' },
  { value: 'move_in', label: 'Move-in' },
  { value: 'move_out', label: 'Move-out' },
  { value: 'post_construction', label: 'Post-construction' },
] as const;

export const CONSULTATION_FREQUENCIES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
] as const;

export const CONSULTATION_CONDITIONS = [
  { value: 'light', label: 'Light' },
  { value: 'average', label: 'Average' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'very_heavy', label: 'Very heavy' },
] as const;

export const CONSULTATION_SUPPLIES = [
  { value: 'customer', label: 'Customer provides supplies' },
  { value: 'company', label: 'Company brings supplies' },
] as const;

export const CONSULTATION_PETS = [
  { value: 'none', label: 'None' },
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'other', label: 'Other' },
] as const;

export const CONSULTATION_SPACE_TYPES = [
  { value: 'office', label: 'Office' },
  { value: 'medical', label: 'Medical' },
  { value: 'retail', label: 'Retail' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'other', label: 'Other' },
] as const;

export const CONSULTATION_ON_SITE = [
  { value: 'business_hours', label: 'Business hours' },
  { value: 'after_hours', label: 'After hours' },
  { value: 'either', label: 'Either' },
] as const;

export const CONSULTATION_AFTER_HOURS_ACCESS = [
  { value: 'alarm', label: 'Alarm' },
  { value: 'lockbox', label: 'Lockbox' },
  { value: 'person', label: 'Someone lets the crew in' },
] as const;

export const CONSULTATION_ADDONS = [
  { value: 'oven', label: 'Inside oven' },
  { value: 'fridge', label: 'Inside fridge' },
  { value: 'cabinets', label: 'Inside cabinets' },
  { value: 'windows', label: 'Windows' },
  { value: 'baseboards', label: 'Baseboards' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'garage', label: 'Garage' },
] as const;

export const CONSULTATION_FLOORS = [
  { value: 'hardwood', label: 'Hardwood' },
  { value: 'tile', label: 'Tile' },
  { value: 'carpet', label: 'Carpet' },
  { value: 'mixed', label: 'Mixed' },
] as const;

export const CONSULTATION_LAST_CLEAN = [
  { value: 'never', label: 'Never' },
  { value: 'within_30_days', label: 'Within 30 days' },
  { value: 'one_to_six_months', label: '1–6 months ago' },
  { value: 'longer', label: 'Longer than 6 months' },
] as const;

type Option = readonly { value: string; label: string }[];

export type ConsultationService = (typeof CONSULTATION_SERVICES)[number]['value'];
export type ConsultationFrequency = (typeof CONSULTATION_FREQUENCIES)[number]['value'];
export type ConsultationCondition = (typeof CONSULTATION_CONDITIONS)[number]['value'];
export type ConsultationSupplies = (typeof CONSULTATION_SUPPLIES)[number]['value'];
export type ConsultationPets = (typeof CONSULTATION_PETS)[number]['value'];
export type ConsultationSpaceType = (typeof CONSULTATION_SPACE_TYPES)[number]['value'];
export type ConsultationOnSite = (typeof CONSULTATION_ON_SITE)[number]['value'];
export type ConsultationAfterHoursAccess =
  (typeof CONSULTATION_AFTER_HOURS_ACCESS)[number]['value'];
export type ConsultationAddon = (typeof CONSULTATION_ADDONS)[number]['value'];
export type ConsultationFloor = (typeof CONSULTATION_FLOORS)[number]['value'];
export type ConsultationLastClean = (typeof CONSULTATION_LAST_CLEAN)[number]['value'];

export type ConsultationIntake = {
  propertyKind: CustomerPropertyKind;
  serviceRequested: ConsultationService | null;
  frequency: ConsultationFrequency | null;
  frequencyDetail: string | null;
  sqft: number | null;
  condition: ConsultationCondition | null;
  supplies: ConsultationSupplies | null;
  preferredStart: string | null;
  areasInScope: string;
  areasOutOfScope: string;
  bedrooms: number | null;
  bathrooms: number | null;
  stories: number | null;
  pets: ConsultationPets | null;
  petCount: number | null;
  occupiedDuringClean: boolean | null;
  kidsAtHome: boolean | null;
  homeOffice: boolean | null;
  sameCleaner: boolean | null;
  spaceType: ConsultationSpaceType | null;
  restrooms: number | null;
  breakRooms: number | null;
  storiesOrSuites: number | null;
  onSiteWindow: ConsultationOnSite | null;
  afterHoursAccess: ConsultationAfterHoursAccess | null;
  occupantCount: number | null;
  trashLocations: string | null;
  restockRestrooms: boolean | null;
  crewHeadcount: number | null;
  addons: ConsultationAddon[];
  floorTypes: ConsultationFloor[];
  lastProfessionalClean: ConsultationLastClean | null;
  parkingAndEntry: string | null;
  specialRequests: string | null;
  photoNotes: string | null;
  crewEstimateHours: number | null;
};

export type ConsultationQuotePrefill = {
  propertyKind: CustomerPropertyKind;
  sqft: string;
  bedrooms: string;
  bathrooms: string;
  stories: string;
  accessNotes: string;
  officeNotes: string;
  scopeInclusions: string[];
  scopeExclusions: string;
  serviceLabel: string;
  frequency: ConsultationFrequency;
  frequencyDetail: string;
  estimatedHours: string;
};

export function consultationUsesCommercialFields(kind: CustomerPropertyKind): boolean {
  return kind === 'commercial';
}

function labelFor(options: Option, value: string | null | undefined): string {
  if (!value) return '';
  return options.find((option) => option.value === value)?.label ?? value;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function intOrNull(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function decimalOrNull(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

function hoursOrNull(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function boolOrNull(raw: string): boolean | null {
  if (raw === 'yes') return true;
  if (raw === 'no') return false;
  return null;
}

function oneOf<T extends string>(raw: string, options: readonly { value: T }[]): T | null {
  return options.some((option) => option.value === raw) ? (raw as T) : null;
}

function manyOf<T extends string>(
  formData: FormData,
  name: string,
  options: readonly { value: T }[],
): T[] {
  const allowed = new Set(options.map((option) => option.value));
  return formData
    .getAll(name)
    .map((value) => String(value))
    .filter((value): value is T => allowed.has(value as T));
}

export function parseConsultationIntakeForm(
  formData: FormData,
  propertyKind: CustomerPropertyKind,
): ConsultationIntake {
  const frequency = oneOf(text(formData, 'frequency'), CONSULTATION_FREQUENCIES);
  const pets = oneOf(text(formData, 'pets'), CONSULTATION_PETS);
  return {
    propertyKind,
    serviceRequested: oneOf(text(formData, 'service_requested'), CONSULTATION_SERVICES),
    frequency,
    frequencyDetail: frequency === 'custom' ? text(formData, 'frequency_detail') || null : null,
    sqft: intOrNull(text(formData, 'sqft')),
    condition: oneOf(text(formData, 'condition'), CONSULTATION_CONDITIONS),
    supplies: oneOf(text(formData, 'supplies'), CONSULTATION_SUPPLIES),
    preferredStart: text(formData, 'preferred_start') || null,
    areasInScope: text(formData, 'areas_in_scope'),
    areasOutOfScope: text(formData, 'areas_out_of_scope'),
    bedrooms: intOrNull(text(formData, 'bedrooms')),
    bathrooms: decimalOrNull(text(formData, 'bathrooms')),
    stories: intOrNull(text(formData, 'stories')),
    pets,
    petCount: pets && pets !== 'none' ? intOrNull(text(formData, 'pet_count')) : null,
    occupiedDuringClean: boolOrNull(text(formData, 'occupied_during_clean')),
    kidsAtHome: boolOrNull(text(formData, 'kids_at_home')),
    homeOffice: boolOrNull(text(formData, 'home_office')),
    sameCleaner: boolOrNull(text(formData, 'same_cleaner')),
    spaceType: oneOf(text(formData, 'space_type'), CONSULTATION_SPACE_TYPES),
    restrooms: intOrNull(text(formData, 'restrooms')),
    breakRooms: intOrNull(text(formData, 'break_rooms')),
    storiesOrSuites: intOrNull(text(formData, 'stories_or_suites')),
    onSiteWindow: oneOf(text(formData, 'on_site_window'), CONSULTATION_ON_SITE),
    afterHoursAccess: oneOf(text(formData, 'after_hours_access'), CONSULTATION_AFTER_HOURS_ACCESS),
    occupantCount: intOrNull(text(formData, 'occupant_count')),
    trashLocations: text(formData, 'trash_locations') || null,
    restockRestrooms: boolOrNull(text(formData, 'restock_restrooms')),
    crewHeadcount: intOrNull(text(formData, 'crew_headcount')),
    addons: manyOf(formData, 'addons', CONSULTATION_ADDONS),
    floorTypes: manyOf(formData, 'floor_types', CONSULTATION_FLOORS),
    lastProfessionalClean: oneOf(
      text(formData, 'last_professional_clean'),
      CONSULTATION_LAST_CLEAN,
    ),
    parkingAndEntry: text(formData, 'parking_and_entry') || null,
    specialRequests: text(formData, 'special_requests') || null,
    photoNotes: text(formData, 'photo_notes') || null,
    crewEstimateHours: hoursOrNull(text(formData, 'crew_estimate_hours')),
  };
}

function requireText(errors: string[], value: string, label: string) {
  if (!value.trim()) errors.push(`${label} is required.`);
}

function requireNumber(errors: string[], value: number | null, label: string) {
  if (value == null) errors.push(`${label} is required.`);
}

export function consultationIntakeErrors(intake: ConsultationIntake): string[] {
  const errors: string[] = [];
  if (!intake.serviceRequested) errors.push('Service requested is required.');
  if (!intake.frequency) errors.push('How often is required.');
  if (intake.frequency === 'custom')
    requireText(errors, intake.frequencyDetail ?? '', 'Custom cadence');
  if (intake.sqft == null || !Number.isInteger(intake.sqft) || intake.sqft <= 0) {
    errors.push('Square footage is required.');
  }
  if (!intake.condition) errors.push('Current condition is required.');
  if (!intake.supplies) errors.push('Supplies is required.');
  if (!intake.preferredStart || !/^\d{4}-\d{2}-\d{2}$/.test(intake.preferredStart)) {
    errors.push('Preferred start date is required.');
  }
  requireText(errors, intake.areasInScope, 'Areas in scope');
  requireText(errors, intake.areasOutOfScope, 'Areas out of scope');

  if (consultationUsesCommercialFields(intake.propertyKind)) {
    if (!intake.spaceType) errors.push('Space type is required.');
    requireNumber(errors, intake.restrooms, 'Restrooms');
    requireNumber(errors, intake.breakRooms, 'Break rooms or kitchens');
    requireNumber(errors, intake.storiesOrSuites, 'Stories or suites');
    if (!intake.onSiteWindow) errors.push('When the crew can be on site is required.');
    if (!intake.afterHoursAccess) errors.push('After-hours access is required.');
  } else {
    requireNumber(errors, intake.bedrooms, 'Bedrooms');
    if (intake.bathrooms == null || intake.bathrooms <= 0) errors.push('Bathrooms is required.');
    requireNumber(errors, intake.stories, 'Stories');
    if (!intake.pets) errors.push('Pets is required.');
    if (
      intake.pets &&
      intake.pets !== 'none' &&
      (intake.petCount == null || intake.petCount <= 0)
    ) {
      errors.push('Pet count is required.');
    }
    if (intake.occupiedDuringClean == null) {
      errors.push('Home occupied during the clean is required.');
    }
  }

  return errors;
}

export function isConsultationIntakeComplete(raw: unknown): boolean {
  const intake = parseStoredConsultationIntake(raw);
  return intake != null && consultationIntakeErrors(intake).length === 0;
}

export function parseStoredConsultationIntake(raw: unknown): ConsultationIntake | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const propertyKind = o.propertyKind;
  if (
    propertyKind !== 'residential' &&
    propertyKind !== 'commercial' &&
    propertyKind !== 'short_term_rental' &&
    propertyKind !== 'other'
  ) {
    return null;
  }

  const form = new FormData();
  const set = (name: string, value: unknown) => {
    if (value == null || value === '') return;
    form.set(name, String(value));
  };
  set('service_requested', o.serviceRequested);
  set('frequency', o.frequency);
  set('frequency_detail', o.frequencyDetail);
  set('sqft', o.sqft);
  set('condition', o.condition);
  set('supplies', o.supplies);
  set('preferred_start', o.preferredStart);
  set('areas_in_scope', o.areasInScope);
  set('areas_out_of_scope', o.areasOutOfScope);
  set('bedrooms', o.bedrooms);
  set('bathrooms', o.bathrooms);
  set('stories', o.stories);
  set('pets', o.pets);
  set('pet_count', o.petCount);
  set(
    'occupied_during_clean',
    o.occupiedDuringClean === true ? 'yes' : o.occupiedDuringClean === false ? 'no' : '',
  );
  set('kids_at_home', o.kidsAtHome === true ? 'yes' : o.kidsAtHome === false ? 'no' : '');
  set('home_office', o.homeOffice === true ? 'yes' : o.homeOffice === false ? 'no' : '');
  set('same_cleaner', o.sameCleaner === true ? 'yes' : o.sameCleaner === false ? 'no' : '');
  set('space_type', o.spaceType);
  set('restrooms', o.restrooms);
  set('break_rooms', o.breakRooms);
  set('stories_or_suites', o.storiesOrSuites);
  set('on_site_window', o.onSiteWindow);
  set('after_hours_access', o.afterHoursAccess);
  set('occupant_count', o.occupantCount);
  set('trash_locations', o.trashLocations);
  set(
    'restock_restrooms',
    o.restockRestrooms === true ? 'yes' : o.restockRestrooms === false ? 'no' : '',
  );
  set('crew_headcount', o.crewHeadcount);
  set('last_professional_clean', o.lastProfessionalClean);
  set('parking_and_entry', o.parkingAndEntry);
  set('special_requests', o.specialRequests);
  set('photo_notes', o.photoNotes);
  set('crew_estimate_hours', o.crewEstimateHours);
  if (Array.isArray(o.addons)) {
    for (const addon of o.addons) form.append('addons', String(addon));
  }
  if (Array.isArray(o.floorTypes)) {
    for (const floor of o.floorTypes) form.append('floor_types', String(floor));
  }
  return parseConsultationIntakeForm(form, propertyKind);
}

function yesNo(value: boolean | null): string {
  if (value == null) return '';
  return value ? 'Yes' : 'No';
}

export function formatConsultationIntakeSummary(intake: ConsultationIntake): string {
  const lines = [
    `Service: ${labelFor(CONSULTATION_SERVICES, intake.serviceRequested)}`,
    `How often: ${labelFor(CONSULTATION_FREQUENCIES, intake.frequency)}${intake.frequencyDetail ? ` (${intake.frequencyDetail})` : ''}`,
    `Square footage: ${intake.sqft ?? '—'}`,
    `Condition: ${labelFor(CONSULTATION_CONDITIONS, intake.condition)}`,
    `Supplies: ${labelFor(CONSULTATION_SUPPLIES, intake.supplies)}`,
    intake.preferredStart ? `Preferred start: ${intake.preferredStart}` : '',
    `In scope:\n${intake.areasInScope}`,
    `Out of scope:\n${intake.areasOutOfScope}`,
  ];

  if (consultationUsesCommercialFields(intake.propertyKind)) {
    lines.push(
      `Space: ${labelFor(CONSULTATION_SPACE_TYPES, intake.spaceType)}`,
      `Restrooms: ${intake.restrooms ?? '—'}`,
      `Break rooms or kitchens: ${intake.breakRooms ?? '—'}`,
      `Stories or suites: ${intake.storiesOrSuites ?? '—'}`,
      `On site: ${labelFor(CONSULTATION_ON_SITE, intake.onSiteWindow)}`,
      `Access: ${labelFor(CONSULTATION_AFTER_HOURS_ACCESS, intake.afterHoursAccess)}`,
      intake.occupantCount != null ? `Occupants: ${intake.occupantCount}` : '',
      intake.trashLocations ? `Trash and recycling: ${intake.trashLocations}` : '',
      intake.restockRestrooms != null ? `Restock restrooms: ${yesNo(intake.restockRestrooms)}` : '',
      intake.crewHeadcount != null ? `Requested crew: ${intake.crewHeadcount}` : '',
    );
  } else {
    lines.push(
      `Bedrooms: ${intake.bedrooms ?? '—'}`,
      `Bathrooms: ${intake.bathrooms ?? '—'}`,
      `Stories: ${intake.stories ?? '—'}`,
      `Pets: ${labelFor(CONSULTATION_PETS, intake.pets)}${intake.petCount ? ` (${intake.petCount})` : ''}`,
      `Occupied during clean: ${yesNo(intake.occupiedDuringClean)}`,
      intake.kidsAtHome != null ? `Kids at home: ${yesNo(intake.kidsAtHome)}` : '',
      intake.homeOffice != null ? `Home office: ${yesNo(intake.homeOffice)}` : '',
      intake.sameCleaner != null ? `Same cleaner each visit: ${yesNo(intake.sameCleaner)}` : '',
    );
  }

  if (intake.addons.length > 0) {
    lines.push(
      `Add-ons: ${intake.addons.map((addon) => labelFor(CONSULTATION_ADDONS, addon)).join(', ')}`,
    );
  }
  if (intake.floorTypes.length > 0) {
    lines.push(
      `Floors: ${intake.floorTypes.map((floor) => labelFor(CONSULTATION_FLOORS, floor)).join(', ')}`,
    );
  }
  if (intake.lastProfessionalClean) {
    lines.push(
      `Last professional clean: ${labelFor(CONSULTATION_LAST_CLEAN, intake.lastProfessionalClean)}`,
    );
  }
  if (intake.parkingAndEntry) lines.push(`Parking and entry: ${intake.parkingAndEntry}`);
  if (intake.specialRequests) lines.push(`Special requests: ${intake.specialRequests}`);
  if (intake.photoNotes) lines.push(`Photo notes: ${intake.photoNotes}`);
  if (intake.crewEstimateHours != null)
    lines.push(`Crew estimate: ${intake.crewEstimateHours} hours`);

  return lines.filter(Boolean).join('\n');
}

export function quotePrefillFromConsultation(intake: ConsultationIntake): ConsultationQuotePrefill {
  const accessNotes = [intake.parkingAndEntry, intake.specialRequests].filter(Boolean).join('\n');
  const stories = consultationUsesCommercialFields(intake.propertyKind)
    ? intake.storiesOrSuites
    : intake.stories;
  return {
    propertyKind: intake.propertyKind,
    sqft: intake.sqft != null ? String(intake.sqft) : '',
    bedrooms: intake.bedrooms != null ? String(intake.bedrooms) : '',
    bathrooms: intake.bathrooms != null ? String(intake.bathrooms) : '',
    stories: stories != null ? String(stories) : '',
    accessNotes,
    officeNotes: formatConsultationIntakeSummary(intake),
    scopeInclusions: intake.areasInScope
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    scopeExclusions: intake.areasOutOfScope,
    serviceLabel: labelFor(CONSULTATION_SERVICES, intake.serviceRequested),
    frequency: intake.frequency ?? 'one_time',
    frequencyDetail: intake.frequencyDetail ?? '',
    estimatedHours: intake.crewEstimateHours != null ? String(intake.crewEstimateHours) : '',
  };
}
