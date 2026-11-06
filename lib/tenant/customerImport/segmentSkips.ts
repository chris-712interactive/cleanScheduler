import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import {
  propertyKindAllowed,
  propertyKindDeniedMessage,
  type SegmentCapabilities,
} from '@/lib/tenant/serviceSegment';

export type SegmentSkippedProperty = {
  label: string | null;
  kind: string;
  reason: string;
};

export function splitPropertiesForSegment<
  T extends { kind: CustomerPropertyKind; label: string | null },
>(
  capabilities: SegmentCapabilities,
  properties: T[],
): { kept: T[]; skipped: SegmentSkippedProperty[] } {
  const kept: T[] = [];
  const skipped: SegmentSkippedProperty[] = [];
  for (const property of properties) {
    if (propertyKindAllowed(capabilities, property.kind)) {
      kept.push(property);
    } else {
      skipped.push({
        label: property.label,
        kind: property.kind,
        reason: propertyKindDeniedMessage(capabilities),
      });
    }
  }
  return { kept, skipped };
}

export function formatSegmentSkipSummary(skips: SegmentSkippedProperty[]): string | null {
  if (skips.length === 0) return null;
  const names = skips
    .slice(0, 5)
    .map((skip) => skip.label?.trim() || skip.kind)
    .filter(Boolean);
  const extra = skips.length > names.length ? ` and ${skips.length - names.length} more` : '';
  const listed = names.length > 0 ? ` (${names.join(', ')}${extra})` : '';
  const reason = skips[0]?.reason ?? 'This workspace does not serve that property type.';
  const noun = skips.length === 1 ? 'address' : 'addresses';
  return `Skipped ${skips.length} ${noun}${listed}. ${reason}`;
}
