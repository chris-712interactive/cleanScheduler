import type { SchedulePolicyPresetId } from '@/lib/schedule/optimizer/policy';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';
import type { QuoteLinePricingMethod } from '@/lib/tenant/quoteLinePricingMethod';
import { QUOTE_LINE_PRICING_METHOD_OPTIONS } from '@/lib/tenant/quoteLinePricingMethod';
import {
  QUOTE_ADDON_LIBRARY,
  QUOTE_SCOPE_TEMPLATES,
  type QuoteAddonTemplate,
  type QuoteScopeTemplate,
  type QuoteScopeTemplateId,
} from '@/lib/tenant/quoteScopeTemplates';

export type TenantServiceSegment = 'residential' | 'commercial' | 'both';

export type ServiceDirectorySegment = 'all' | 'residential' | 'commercial';

export type BookingServiceOption = {
  value: string;
  label: string;
  family: 'residential' | 'commercial' | 'shared';
};

export type SegmentCapabilities = {
  segment: TenantServiceSegment;
  offersResidential: boolean;
  offersCommercial: boolean;
  offersBoth: boolean;
  /** Property kinds this workspace may create. `other` stays available as a neutral type. */
  propertyKinds: CustomerPropertyKind[];
  showBedsBaths: boolean;
  /** Cleanable square footage, used for commercial bids. */
  showSqft: boolean;
  sqftBids: boolean;
  pricingMethods: { value: QuoteLinePricingMethod; label: string }[];
  scopeTemplates: QuoteScopeTemplate[];
  addons: QuoteAddonTemplate[];
  schedulePresets: SchedulePolicyPresetId[];
  bookingServices: BookingServiceOption[];
  /** Consultation required-field groups from operational settings. */
  consultationGroups: Array<'all' | 'home' | 'commercial'>;
};

const RESIDENTIAL_KINDS: CustomerPropertyKind[] = ['residential', 'short_term_rental'];
const COMMERCIAL_KINDS: CustomerPropertyKind[] = ['commercial'];

const BOOKING_SERVICES: BookingServiceOption[] = [
  { value: 'Standard clean', label: 'Standard clean', family: 'residential' },
  { value: 'Deep clean', label: 'Deep clean', family: 'residential' },
  { value: 'Move-in / move-out', label: 'Move-in / move-out', family: 'residential' },
  { value: 'Recurring service', label: 'Recurring home service', family: 'residential' },
  { value: 'Office / commercial', label: 'Office / commercial', family: 'commercial' },
  { value: 'Recurring janitorial', label: 'Recurring janitorial', family: 'commercial' },
  { value: 'Other', label: 'Other', family: 'shared' },
];

const RESIDENTIAL_SCOPE_IDS = new Set<QuoteScopeTemplateId>([
  'residential_standard',
  'move_out_deep',
  'custom',
]);
const COMMERCIAL_SCOPE_IDS = new Set<QuoteScopeTemplateId>(['commercial_office', 'custom']);

const RESIDENTIAL_ADDON_LABELS = new Set([
  'Inside oven',
  'Inside fridge',
  'Garage sweep',
  'Laundry — fold only',
  'Pet hair surcharge',
]);

export const SERVICE_SEGMENT_OPTIONS: {
  value: TenantServiceSegment;
  label: string;
  hint: string;
}[] = [
  {
    value: 'residential',
    label: 'Residential only',
    hint: 'Homes and short-term rentals. Commercial bids, sites, and office presets stay hidden.',
  },
  {
    value: 'commercial',
    label: 'Commercial only',
    hint: 'Offices and facilities. Beds, baths, and home-cleaning presets stay hidden.',
  },
  {
    value: 'both',
    label: 'Residential and commercial',
    hint: 'Both lines of work, labeled so a home quote is not mixed up with a building contract.',
  },
];

/** Unknown or empty values stay `both` so an existing workspace does not lose a line of work. */
export function parseTenantServiceSegment(raw: unknown): TenantServiceSegment {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'residential' || value === 'commercial' || value === 'both') return value;
  if (value.includes('commercial') && (value.includes('residential') || value.includes('both'))) {
    return 'both';
  }
  if (value === 'janitorial' || value === 'office') return 'commercial';
  if (value === 'home' || value === 'maid' || value === 'house') return 'residential';
  return 'both';
}

export function propertyKindFamily(
  kind: CustomerPropertyKind,
): 'residential' | 'commercial' | 'other' {
  if (kind === 'commercial') return 'commercial';
  if (kind === 'residential' || kind === 'short_term_rental') return 'residential';
  return 'other';
}

export function capabilitiesForSegment(
  segment: TenantServiceSegment | null | undefined,
): SegmentCapabilities {
  const resolved = parseTenantServiceSegment(segment ?? 'both');
  const offersResidential = resolved !== 'commercial';
  const offersCommercial = resolved !== 'residential';
  const propertyKinds = PROPERTY_KIND_OPTIONS.map((option) => option.value).filter((kind) => {
    if (kind === 'other') return true;
    if (RESIDENTIAL_KINDS.includes(kind)) return offersResidential;
    if (COMMERCIAL_KINDS.includes(kind)) return offersCommercial;
    return false;
  });

  const scopeIds = new Set<QuoteScopeTemplateId>(['custom']);
  if (offersResidential) {
    for (const id of RESIDENTIAL_SCOPE_IDS) scopeIds.add(id);
  }
  if (offersCommercial) {
    for (const id of COMMERCIAL_SCOPE_IDS) scopeIds.add(id);
  }

  return {
    segment: resolved,
    offersResidential,
    offersCommercial,
    offersBoth: offersResidential && offersCommercial,
    propertyKinds,
    showBedsBaths: offersResidential,
    showSqft: offersCommercial,
    sqftBids: offersCommercial,
    pricingMethods: QUOTE_LINE_PRICING_METHOD_OPTIONS.filter(
      (option) => option.value !== 'per_sqft' || offersCommercial,
    ),
    scopeTemplates: QUOTE_SCOPE_TEMPLATES.filter((template) => scopeIds.has(template.id)),
    addons: offersResidential
      ? QUOTE_ADDON_LIBRARY.filter((addon) => RESIDENTIAL_ADDON_LABELS.has(addon.service_label))
      : [],
    schedulePresets: (
      ['balanced', 'residential_routes', 'commercial_sites', 'even_workload'] as const
    ).filter((preset) => {
      if (preset === 'residential_routes') return offersResidential;
      if (preset === 'commercial_sites') return offersCommercial;
      return true;
    }),
    bookingServices: BOOKING_SERVICES.filter((option) => {
      if (option.family === 'shared') return true;
      if (option.family === 'residential') return offersResidential;
      return offersCommercial;
    }),
    consultationGroups: [
      'all',
      ...(offersResidential ? (['home'] as const) : []),
      ...(offersCommercial ? (['commercial'] as const) : []),
    ],
  };
}

export function propertyKindAllowed(
  capabilities: SegmentCapabilities,
  kind: CustomerPropertyKind,
): boolean {
  return capabilities.propertyKinds.includes(kind);
}

export function defaultPropertyKind(capabilities: SegmentCapabilities): CustomerPropertyKind {
  if (!capabilities.offersResidential && capabilities.offersCommercial) return 'commercial';
  return 'residential';
}

export function propertyKindDeniedMessage(capabilities: SegmentCapabilities): string {
  if (!capabilities.offersCommercial) {
    return 'This workspace only serves homes and short-term rentals.';
  }
  if (!capabilities.offersResidential) {
    return 'This workspace only serves commercial properties.';
  }
  return 'That property type is not available for this workspace.';
}

/**
 * Block a new or changed property kind the segment does not offer.
 * Saving a location that already has a disallowed kind (from before the setting changed) still succeeds.
 */
export function propertyKindWriteError(
  capabilities: SegmentCapabilities,
  nextKind: CustomerPropertyKind,
  existingKind?: CustomerPropertyKind | null,
): string | null {
  if (propertyKindAllowed(capabilities, nextKind)) return null;
  if (existingKind && existingKind === nextKind) return null;
  return propertyKindDeniedMessage(capabilities);
}

export function sqftBidAllowedForProperty(
  capabilities: SegmentCapabilities,
  propertyKind: CustomerPropertyKind | null | undefined,
): boolean {
  return capabilities.sqftBids && propertyKind === 'commercial';
}

export function sqftBidDeniedMessage(
  capabilities: SegmentCapabilities,
  propertyKind: CustomerPropertyKind | null | undefined,
): string | null {
  if (!capabilities.sqftBids) {
    return 'Square-foot bids are only available for commercial cleaning workspaces.';
  }
  if (propertyKind !== 'commercial') {
    return 'Square-foot bids are only for commercial properties.';
  }
  return null;
}

export function bookingServiceAllowed(
  capabilities: SegmentCapabilities,
  raw: string | null | undefined,
): boolean {
  const value = raw?.trim() ?? '';
  if (!value) return true;
  return capabilities.bookingServices.some((option) => option.value === value);
}

export function bookingServiceDeniedMessage(): string {
  return 'That service is not offered by this cleaning company.';
}

export function parseServiceDirectorySegment(raw: unknown): ServiceDirectorySegment {
  const value = String(raw ?? '').trim();
  if (value === 'residential' || value === 'commercial') return value;
  return 'all';
}

/** Kinds included in a customers or schedule tab. `null` means no extra filter. */
export function propertyKindsForDirectorySegment(
  segment: ServiceDirectorySegment,
): CustomerPropertyKind[] | null {
  if (segment === 'residential') return [...RESIDENTIAL_KINDS];
  if (segment === 'commercial') return [...COMMERCIAL_KINDS];
  return null;
}

export function segmentCustomersTitleHint(capabilities: SegmentCapabilities): string {
  if (!capabilities.offersCommercial) {
    return 'Homes and short-term rentals you serve under this workspace.';
  }
  if (!capabilities.offersResidential) {
    return 'Commercial accounts you serve under this workspace.';
  }
  return 'Residential and commercial accounts. Use the tabs when you want one line of work at a time.';
}

export function segmentLocationsDescription(capabilities: SegmentCapabilities): string {
  if (!capabilities.offersCommercial) {
    return 'Add another home or short-term rental for this customer.';
  }
  if (!capabilities.offersResidential) {
    return 'Commercial accounts often have more than one site on the same contract.';
  }
  return 'Add a home or a commercial site. Each location is labeled so the two stay distinct.';
}
