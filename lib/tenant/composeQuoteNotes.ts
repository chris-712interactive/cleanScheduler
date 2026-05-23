export function composeQuoteNotesFromWizardFields(input: {
  scopeInclusions?: string[];
  scopeExclusions?: string;
  propertyType?: string;
  propertySqft?: string;
  propertyBedsBaths?: string;
  propertyStories?: string;
  accessNotes?: string;
  officeNotes?: string;
}): string | null {
  const sections: string[] = [];

  const snapshotParts = [
    input.propertyType?.trim() ? `Type: ${input.propertyType.trim()}` : '',
    input.propertySqft?.trim() ? `Sq ft: ${input.propertySqft.trim()}` : '',
    input.propertyBedsBaths?.trim() ? `Beds / baths: ${input.propertyBedsBaths.trim()}` : '',
    input.propertyStories?.trim() ? `Stories: ${input.propertyStories.trim()}` : '',
  ].filter(Boolean);

  if (snapshotParts.length > 0) {
    sections.push(['Property snapshot:', ...snapshotParts.map((p) => `• ${p}`)].join('\n'));
  }

  if (input.accessNotes?.trim()) {
    sections.push(`Access and on-site:\n${input.accessNotes.trim()}`);
  }

  const inclusions = (input.scopeInclusions ?? []).map((item) => item.trim()).filter(Boolean);
  if (inclusions.length > 0) {
    sections.push(['Scope — included:', ...inclusions.map((item) => `• ${item}`)].join('\n'));
  }

  if (input.scopeExclusions?.trim()) {
    sections.push(`Scope — excluded:\n${input.scopeExclusions.trim()}`);
  }

  if (input.officeNotes?.trim()) {
    sections.push(`[Office only]\n${input.officeNotes.trim()}`);
  }

  if (sections.length === 0) return null;
  return sections.join('\n\n');
}
