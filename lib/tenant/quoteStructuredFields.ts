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
export function parseQuoteWizardStructuredFromForm(formData: FormData): {
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

  const propertySnapshot: QuotePropertySnapshot = {
    property_kind: parseCustomerPropertyKind(
      String(formData.get('quote_property_kind') ?? 'residential'),
    ),
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
