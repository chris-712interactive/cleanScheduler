import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { PROPERTY_KIND_LABEL } from '@/lib/tenant/propertyKindLabels';
import type { QuoteScopeTemplateId } from '@/lib/tenant/quoteScopeTemplates';

export type QuoteScopeSnapshot = {
  template_id?: QuoteScopeTemplateId | string | null;
  inclusions: string[];
  exclusions?: string | null;
};

export type QuotePropertySnapshot = {
  property_kind?: CustomerPropertyKind | null;
  sqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  stories?: number | null;
  access_notes?: string | null;
};

export function emptyQuoteScopeSnapshot(): QuoteScopeSnapshot {
  return { inclusions: [] };
}

export function emptyQuotePropertySnapshot(): QuotePropertySnapshot {
  return {};
}

export function parseQuoteScopeSnapshot(raw: unknown): QuoteScopeSnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyQuoteScopeSnapshot();
  }
  const o = raw as Record<string, unknown>;
  const inclusions = Array.isArray(o.inclusions)
    ? o.inclusions.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const exclusions =
    o.exclusions == null || o.exclusions === '' ? null : String(o.exclusions).trim() || null;
  const template_id =
    o.template_id == null || o.template_id === '' ? null : String(o.template_id).trim() || null;
  return { template_id, inclusions, exclusions };
}

export function parseQuotePropertySnapshot(raw: unknown): QuotePropertySnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyQuotePropertySnapshot();
  }
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const property_kind = o.property_kind;
  const kind =
    property_kind === 'commercial' ||
    property_kind === 'short_term_rental' ||
    property_kind === 'other' ||
    property_kind === 'residential'
      ? property_kind
      : null;
  return {
    property_kind: kind,
    sqft: num(o.sqft),
    bedrooms: num(o.bedrooms),
    bathrooms: num(o.bathrooms),
    stories: num(o.stories),
    access_notes:
      o.access_notes == null || o.access_notes === ''
        ? null
        : String(o.access_notes).trim() || null,
  };
}

export type QuoteLocationFactPatch = {
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  stories?: number;
  site_notes?: string;
};

/** Beds, baths, sqft, stories, and site notes are copied onto a location only after the quote RPC succeeds. */
const LOCATION_FACTS_AFTER_RPC = [
  'bedrooms',
  'bathrooms',
  'sqft',
  'stories',
  'site_notes',
] as const;

export const LOCATION_FACT_NOTICE = 'location-facts';
export const ENTRY_CODE_NOTICE = 'entry-codes';
export const QUOTE_FOLLOW_UP_NOTICE = 'quote-follow-up';
export const QUOTE_NOTIFY_NOTICE = 'quote-notify';

export const LOCATION_FACT_SYNC_WARNING =
  'The quote was saved, but bedrooms, bathrooms, square feet, stories, or site notes could not be copied onto the location.';

export const ENTRY_CODE_SAVE_WARNING =
  'The quote was saved, but entry codes could not be stored. Open the service location and enter the gate, door, and garage codes again.';

export const QUOTE_FOLLOW_UP_WARNING =
  'The quote was saved, but some location or crew details could not be stored. Open the quote and save those details again.';

export const QUOTE_NOTIFY_WARNING =
  'The quote was saved and marked sent, but the customer could not be notified.';

const QUOTE_SAVE_NOTICES: Record<string, string> = {
  [LOCATION_FACT_NOTICE]: LOCATION_FACT_SYNC_WARNING,
  [ENTRY_CODE_NOTICE]: ENTRY_CODE_SAVE_WARNING,
  [QUOTE_FOLLOW_UP_NOTICE]: QUOTE_FOLLOW_UP_WARNING,
  [QUOTE_NOTIFY_NOTICE]: QUOTE_NOTIFY_WARNING,
};

/** Maps one or more notice codes (comma-separated) to customer-safe copy. Unknown codes are dropped. */
export function quoteSaveNotice(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const messages: string[] = [];
  for (const part of code.split(',')) {
    const text = QUOTE_SAVE_NOTICES[part.trim()];
    if (text && !messages.includes(text)) messages.push(text);
  }
  return messages.length > 0 ? messages.join(' ') : undefined;
}

export function quoteLocationFactPatch(snapshot: QuotePropertySnapshot): QuoteLocationFactPatch {
  const patch: QuoteLocationFactPatch = {};
  if (snapshot.bedrooms != null) patch.bedrooms = snapshot.bedrooms;
  if (snapshot.bathrooms != null) patch.bathrooms = snapshot.bathrooms;
  if (snapshot.sqft != null) patch.sqft = snapshot.sqft;
  if (snapshot.stories != null) patch.stories = snapshot.stories;
  if (snapshot.access_notes?.trim()) patch.site_notes = snapshot.access_notes.trim();
  return patch;
}

/** Drop location facts that must wait for the quote RPC. The address stays. */
export function inlinePropertyDeferringLocationFacts<T extends object>(property: T): T {
  const next = { ...property } as T & Record<string, unknown>;
  for (const key of LOCATION_FACTS_AFTER_RPC) {
    delete next[key];
  }
  return next;
}

export function parseOptionalSmallInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

export function parseOptionalDecimal(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseCustomerPropertyKind(raw: string): CustomerPropertyKind {
  const t = raw.trim();
  if (t === 'commercial' || t === 'short_term_rental' || t === 'other') return t;
  return 'residential';
}

/** Customer-visible notes derived from scope + property access (not internal). */
export function composeCustomerQuoteNotes(input: {
  scope: QuoteScopeSnapshot;
  property: QuotePropertySnapshot;
}): string | null {
  const sections: string[] = [];

  const snapshotParts = [
    input.property.property_kind
      ? `Type: ${PROPERTY_KIND_LABEL[input.property.property_kind]}`
      : '',
    input.property.sqft != null ? `Sq ft: ${input.property.sqft}` : '',
    input.property.bedrooms != null ? `Bedrooms: ${input.property.bedrooms}` : '',
    input.property.bathrooms != null ? `Bathrooms: ${input.property.bathrooms}` : '',
    input.property.stories != null ? `Stories: ${input.property.stories}` : '',
  ].filter(Boolean);

  if (snapshotParts.length > 0) {
    sections.push(['Property snapshot:', ...snapshotParts.map((p) => `• ${p}`)].join('\n'));
  }

  if (input.property.access_notes?.trim()) {
    sections.push(`Access and on-site:\n${input.property.access_notes.trim()}`);
  }

  if (input.scope.inclusions.length > 0) {
    sections.push(
      ['Scope — included:', ...input.scope.inclusions.map((item) => `• ${item}`)].join('\n'),
    );
  }

  if (input.scope.exclusions?.trim()) {
    sections.push(`Scope — excluded:\n${input.scope.exclusions.trim()}`);
  }

  if (sections.length === 0) return null;
  return sections.join('\n\n');
}

function parseScopeInclusionsJson(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Reads wizard hidden + visible fields into structured quote columns. */
export function parseQuoteWizardStructuredFromForm(
  formData: FormData,
  fallbackKind: CustomerPropertyKind = 'residential',
): {
  scopeSnapshot: QuoteScopeSnapshot;
  propertySnapshot: QuotePropertySnapshot;
  internalNotes: string | null;
  jobType: CustomerPropertyKind | null;
  customerNotes: string | null;
} {
  const scopeInclusions = parseScopeInclusionsJson(String(formData.get('scope_inclusions') ?? ''));
  const scopeExclusions = String(formData.get('scope_exclusions') ?? '').trim();
  const templateRaw = String(formData.get('scope_template_id') ?? '').trim();

  const scopeSnapshot: QuoteScopeSnapshot = {
    template_id: (templateRaw || null) as QuoteScopeTemplateId | string | null,
    inclusions: scopeInclusions,
    exclusions: scopeExclusions || null,
  };

  const postedKind = String(formData.get('quote_property_kind') ?? '').trim();
  const propertySnapshot: QuotePropertySnapshot = {
    property_kind: postedKind ? parseCustomerPropertyKind(postedKind) : fallbackKind,
    sqft: parseOptionalSmallInt(String(formData.get('quote_property_sqft') ?? '')),
    bedrooms: parseOptionalSmallInt(String(formData.get('quote_property_bedrooms') ?? '')),
    bathrooms: parseOptionalDecimal(String(formData.get('quote_property_bathrooms') ?? '')),
    stories: parseOptionalSmallInt(String(formData.get('quote_property_stories') ?? '')),
    access_notes: String(formData.get('access_notes') ?? '').trim() || null,
  };

  const internalNotes = String(formData.get('office_notes') ?? '').trim() || null;
  const jobType = propertySnapshot.property_kind ?? null;
  const customerNotes = composeCustomerQuoteNotes({
    scope: scopeSnapshot,
    property: propertySnapshot,
  });

  return { scopeSnapshot, propertySnapshot, internalNotes, jobType, customerNotes };
}
