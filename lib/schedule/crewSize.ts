export const CREW_SIZE_MIN = 1;
export const CREW_SIZE_MAX = 8;

export type JobTypeCrewDefault = {
  id?: string;
  serviceLabel: string;
  propertyKind: string;
  crewSize: number;
};

function clampCrewSize(value: number | null | undefined): number {
  if (value == null || !Number.isInteger(value)) return CREW_SIZE_MIN;
  return Math.min(CREW_SIZE_MAX, Math.max(CREW_SIZE_MIN, value));
}

/**
 * A visit needs the location's crew, or the job type's minimum, whichever is
 * higher. A deep clean can ask for two people without changing a regular clean
 * at the same house.
 */
export function requiredCrewForVisit(input: {
  propertyCrewSize?: number | null;
  propertyKind?: string | null;
  serviceLabel?: string | null;
  serviceTemplateId?: string | null;
  catalog: JobTypeCrewDefault[];
}): number {
  const propertySize = clampCrewSize(input.propertyCrewSize);
  const byId = input.serviceTemplateId
    ? input.catalog.find((entry) => entry.id === input.serviceTemplateId)
    : undefined;
  if (byId) return Math.max(propertySize, clampCrewSize(byId.crewSize));

  const label = input.serviceLabel?.trim().toLowerCase();
  if (!label) return propertySize;
  const matches = input.catalog.filter(
    (entry) => entry.serviceLabel.trim().toLowerCase() === label,
  );
  if (matches.length === 0) return propertySize;
  const exact = input.propertyKind
    ? matches.find((entry) => entry.propertyKind === input.propertyKind)
    : undefined;
  const jobSize = exact?.crewSize ?? Math.max(...matches.map((entry) => entry.crewSize));
  return Math.max(propertySize, clampCrewSize(jobSize));
}

/** Blank means one cleaner. A typed value must be a whole number from 1 to 8. */
export function parseRequiredCrewSize(
  raw: unknown,
): { ok: true; size: number } | { ok: false; error: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, size: CREW_SIZE_MIN };
  const size = Number(text);
  if (!Number.isInteger(size) || size < CREW_SIZE_MIN || size > CREW_SIZE_MAX) {
    return { ok: false, error: 'Crew size must be a whole number from 1 to 8.' };
  }
  return { ok: true, size };
}
