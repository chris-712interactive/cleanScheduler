export type PropertyFact = {
  label: string;
  value: string;
};

const SERVICE_LABELS = [
  'Service',
  'How often',
  'Condition',
  'Supplies',
  'Preferred start',
  'Crew size',
  'Crew estimate',
  'Add-ons',
] as const;

const HOME_LABELS = [
  'Square footage',
  'Bedrooms',
  'Bathrooms',
  'Stories',
  'Stories or suites',
  'Space',
  'Restrooms',
  'Break rooms or kitchens',
  'Occupants',
] as const;

const INCLUDED_LABELS = ['In scope', 'Out of scope'] as const;

const HOUSEHOLD_LABELS = [
  'Pets',
  'Occupied during clean',
  'Kids at home',
  'Home office',
  'Same cleaner each visit',
  'Floors',
  'Last professional clean',
  'On site',
  'Access',
  'Trash and recycling',
  'Restock restrooms',
] as const;

const ACCESS_LABELS = ['Parking and entry', 'Special requests', 'Photo notes'] as const;

const ALL_LABELS = [
  ...SERVICE_LABELS,
  ...HOME_LABELS,
  ...INCLUDED_LABELS,
  ...HOUSEHOLD_LABELS,
  ...ACCESS_LABELS,
].sort((a, b) => b.length - a.length);

export type OrganizedPropertyDetails = {
  service: PropertyFact[];
  home: PropertyFact[];
  included: PropertyFact[];
  household: PropertyFact[];
  access: PropertyFact[];
  notes: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split a consultation summary into labeled facts. Free text stays in leftover. */
export function parseSiteNoteFacts(raw: string | null | undefined): {
  facts: PropertyFact[];
  leftover: string;
} {
  const text = (raw ?? '').replace(/—\s*Consultation\s+\d{4}-\d{2}-\d{2}\s*—/g, '\n').trim();
  if (!text) return { facts: [], leftover: '' };

  const pattern = new RegExp(`(^|\\s)(${ALL_LABELS.map(escapeRegExp).join('|')}):\\s*`, 'g');
  const hits: { label: string; valueStart: number; labelStart: number }[] = [];
  for (const match of text.matchAll(pattern)) {
    const prefix = match[1] ?? '';
    const label = match[2] ?? '';
    const index = match.index ?? 0;
    hits.push({
      label,
      labelStart: index + prefix.length,
      valueStart: index + match[0].length,
    });
  }
  if (hits.length === 0) return { facts: [], leftover: text };

  const facts = hits.map((hit, index) => {
    const end = hits[index + 1]?.labelStart ?? text.length;
    return { label: hit.label, value: text.slice(hit.valueStart, end).trim() };
  });
  return {
    facts: facts.filter((fact) => fact.value.length > 0),
    leftover: text.slice(0, hits[0]?.labelStart ?? 0).trim(),
  };
}

function factsFor(facts: PropertyFact[], labels: readonly string[]): PropertyFact[] {
  return labels.flatMap((label) => facts.filter((fact) => fact.label === label));
}

function withColumnFact(
  facts: PropertyFact[],
  label: string,
  value: number | null | undefined,
): PropertyFact[] {
  if (value == null || facts.some((fact) => fact.label === label)) return facts;
  return [...facts, { label, value: String(value) }];
}

export function organizePropertyDetails(input: {
  siteNotes?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  stories?: number | null;
}): OrganizedPropertyDetails {
  const parsed = parseSiteNoteFacts(input.siteNotes);
  let home = factsFor(parsed.facts, HOME_LABELS);
  home = withColumnFact(home, 'Bedrooms', input.bedrooms);
  home = withColumnFact(home, 'Bathrooms', input.bathrooms);
  home = withColumnFact(home, 'Square footage', input.sqft);
  home = withColumnFact(home, 'Stories', input.stories);

  return {
    service: factsFor(parsed.facts, SERVICE_LABELS),
    home,
    included: factsFor(parsed.facts, INCLUDED_LABELS),
    household: factsFor(parsed.facts, HOUSEHOLD_LABELS),
    access: factsFor(parsed.facts, ACCESS_LABELS),
    notes: parsed.leftover,
  };
}
